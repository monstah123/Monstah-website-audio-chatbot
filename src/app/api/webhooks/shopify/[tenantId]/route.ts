import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { getShopifyAppConfig, verifyShopifyWebhookHmac } from "@/lib/shopify";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const PAID_STATUSES = new Set(["paid", "partially_refunded"]);

type ShopifyTransaction = {
  kind?: unknown;
  amount?: unknown;
};

type ShopifyRefund = {
  transactions?: unknown;
};

type ShopifyOrder = {
  id?: unknown;
  order_number?: unknown;
  financial_status?: unknown;
  total_price?: unknown;
  currency?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  refunds?: unknown;
};

function parseAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function getRefundTotal(refunds: unknown) {
  if (!Array.isArray(refunds)) return 0;
  return refunds.reduce((total, refund: ShopifyRefund) => {
    if (!Array.isArray(refund?.transactions)) return total;
    return total + refund.transactions.reduce((refundTotal: number, transaction: ShopifyTransaction) => {
      if (transaction?.kind !== "refund") return refundTotal;
      const amount = parseAmount(transaction.amount);
      return refundTotal + (amount ?? 0);
    }, 0);
  }, 0);
}

function toTimestamp(value: unknown, fallback: FirebaseFirestore.Timestamp) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? Timestamp.fromDate(new Date(value))
    : fallback;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Webhook body is required" }, { status: 400 });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch (error) {
    console.error("Unable to read Shopify webhook body:", error);
    return NextResponse.json({ error: "Unable to read webhook body" }, { status: 400 });
  }
  const rawBody = Buffer.concat(chunks);
  const config = getShopifyAppConfig();
  const signature = request.headers.get("x-shopify-hmac-sha256");
  const shop = request.headers.get("x-shopify-shop-domain")?.toLowerCase();
  const topic = request.headers.get("x-shopify-topic");
  if (
    !config ||
    !signature ||
    !shop ||
    !["orders/create", "orders/updated", "app/uninstalled"].includes(topic ?? "")
  ) {
    return NextResponse.json({ error: "Invalid Shopify webhook headers" }, { status: 400 });
  }

  if (!verifyShopifyWebhookHmac(rawBody, signature, config.apiSecret)) {
    return NextResponse.json({ error: "Invalid Shopify webhook signature" }, { status: 401 });
  }

  try {
    const connectionRef = db.collection("shopifyConnections").doc(tenantId);
    const connection = await connectionRef.get();
    if (!connection.exists || connection.data()?.shop !== shop) {
      return NextResponse.json({ error: "Shopify store is not connected to this tenant" }, { status: 404 });
    }

    if (topic === "app/uninstalled") {
      const tenantRef = db.collection("users").doc(tenantId);
      await Promise.all([
        db.recursiveDelete(tenantRef.collection("shopifyOrders")),
        db.recursiveDelete(tenantRef.collection("shopifyStats")),
      ]);
      await connectionRef.delete();
      return NextResponse.json({ accepted: true });
    }

    let order: ShopifyOrder;
    try {
      const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid Shopify order payload" }, { status: 400 });
      }
      order = parsed as ShopifyOrder;
    } catch {
      return NextResponse.json({ error: "Invalid Shopify order JSON" }, { status: 400 });
    }

    if (
      (typeof order.id !== "number" && typeof order.id !== "string") ||
      !/^\d{1,32}$/.test(String(order.id)) ||
      typeof order.financial_status !== "string" ||
      !/^[a-z_]{1,40}$/.test(order.financial_status)
    ) {
      return NextResponse.json({ error: "Invalid Shopify order fields" }, { status: 400 });
    }
    if (typeof order.currency !== "string" || !/^[A-Z]{3}$/.test(order.currency)) {
      return NextResponse.json({ error: "Invalid order currency" }, { status: 400 });
    }
    const currency = order.currency;
    const total = parseAmount(order.total_price);
    if (total === null) return NextResponse.json({ error: "Invalid order total" }, { status: 400 });

    const orderId = String(order.id);
    const status = order.financial_status;
    const orderCategory = status === "refunded"
      ? "refunded"
      : PAID_STATUSES.has(status)
        ? "paid"
        : "other";
    const refundedTotal = status === "refunded"
      ? total
      : Math.min(total, getRefundTotal(order.refunds));
    const netSales = orderCategory === "paid" ? Math.max(0, total - refundedTotal) : 0;
    const now = Timestamp.now();
    const createdAt = toTimestamp(order.created_at, now);
    const orderRef = db.collection("users").doc(tenantId).collection("shopifyOrders").doc(orderId);
    const statsRef = db.collection("users").doc(tenantId).collection("shopifyStats").doc("summary");

    await db.runTransaction(async (transaction) => {
      const [existingOrder, existingStats] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(statsRef),
      ]);
      const previous = existingOrder.data();
      const stats = existingStats.data() ?? {};
      const previousCategory = previous?.orderCategory;
      const previousCurrency = previous?.currency;
      const previousNet = Number(previous?.netSales) || 0;
      const counterDelta = (key: string, category: string) =>
        Number(stats[key] ?? 0) -
        (previousCategory === category ? 1 : 0) +
        (orderCategory === category ? 1 : 0);
      const salesByCurrency: Record<string, number> = { ...(stats.netSalesByCurrency ?? {}) };
      if (previousCurrency) {
        salesByCurrency[previousCurrency] =
          Number(salesByCurrency[previousCurrency] ?? 0) - previousNet;
      }
      salesByCurrency[currency] =
        Number(salesByCurrency[currency] ?? 0) + netSales;

      transaction.set(orderRef, {
        orderId,
        orderNumber: typeof order.order_number === "number" || typeof order.order_number === "string"
          ? String(order.order_number).slice(0, 40)
          : orderId,
        status,
        orderCategory,
        total: total.toFixed(2),
        refundedTotal: refundedTotal.toFixed(2),
        netSales: netSales.toFixed(2),
        currency,
        createdAt,
        updatedAt: toTimestamp(order.updated_at, now),
      });
      transaction.set(statsRef, {
        paidOrders: counterDelta("paidOrders", "paid"),
        otherStatusOrders: counterDelta("otherStatusOrders", "other"),
        refundedOrders: counterDelta("refundedOrders", "refunded"),
        netSalesByCurrency: salesByCurrency,
      });
    });

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("Shopify order webhook processing failed:", error);
    return NextResponse.json({ error: "Unable to process Shopify order webhook" }, { status: 500 });
  }
}
