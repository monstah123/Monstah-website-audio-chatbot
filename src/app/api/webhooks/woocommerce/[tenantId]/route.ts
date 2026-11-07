import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { decryptWooCommerceSecret } from "@/lib/woocommerce-secret";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const PAID_STATUSES = new Set(["processing", "completed"]);

type WooRefund = { total?: unknown };
type WooOrder = {
  id?: unknown;
  status?: unknown;
  total?: unknown;
  currency?: unknown;
  date_created?: unknown;
  refunds?: unknown;
  number?: unknown;
};

function safeCurrency(value: unknown): string {
  return typeof value === "string" && /^[A-Z0-9]{3,8}$/.test(value) ? value : "";
}

function safeAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
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

  const signature = request.headers.get("x-wc-webhook-signature");
  const topic = request.headers.get("x-wc-webhook-topic");
  if (!signature || topic !== "order.updated") {
    return NextResponse.json({ error: "Invalid WooCommerce webhook headers" }, { status: 400 });
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return NextResponse.json({ error: "Webhook body is required" }, { status: 400 });
  }
  const chunks: Uint8Array[] = [];
  let bodyLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyLength += value.byteLength;
      if (bodyLength > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch (error) {
    console.error("Unable to read WooCommerce webhook body:", error);
    return NextResponse.json({ error: "Unable to read webhook body" }, { status: 400 });
  }
  const rawBody = Buffer.concat(chunks);

  try {
    const integrationRef = db.collection("woocommerceWebhookSecrets").doc(tenantId);
    const integration = await integrationRef.get();
    const integrationData = integration.data();
    if (!integration.exists || !integrationData?.encryptedSecret) {
      return NextResponse.json({ error: "WooCommerce integration is not configured" }, { status: 404 });
    }
    const webhookSecret = decryptWooCommerceSecret(integrationData);

    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    let order: WooOrder;
    try {
      const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid WooCommerce order payload" }, { status: 400 });
      }
      order = parsed as WooOrder;
    } catch {
      return NextResponse.json({ error: "Invalid webhook JSON" }, { status: 400 });
    }

    if (
      (typeof order.id !== "number" && typeof order.id !== "string") ||
      !/^\d{1,32}$/.test(String(order.id))
    ) {
      return NextResponse.json({ error: "Invalid WooCommerce order ID" }, { status: 400 });
    }

    const orderId = String(order.id);
    const tenantRef = db.collection("users").doc(tenantId);
    const orderRef = tenantRef.collection("woocommerceOrders").doc(orderId);
    const statsRef = tenantRef.collection("woocommerceStats").doc("summary");

    if (typeof order.status !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(order.status)) {
      return NextResponse.json({ error: "Unsupported WooCommerce order status" }, { status: 400 });
    }

    const currency = safeCurrency(order.currency);
    if (!currency) {
      return NextResponse.json({ error: "Invalid order currency" }, { status: 400 });
    }

    const status = order.status;
    const orderCategory = status === "refunded"
      ? "refunded"
      : PAID_STATUSES.has(status)
        ? "processingCompleted"
        : "other";
    const total = safeAmount(order.total);
    if (total === null) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
    }
    const refunds = Array.isArray(order.refunds) ? order.refunds as WooRefund[] : [];
    const refundedTotal = status === "refunded"
      ? total
      : Math.min(total, refunds.reduce((sum, refund) => {
        const amount = typeof refund?.total === "string" || typeof refund?.total === "number"
          ? Number(refund.total)
          : 0;
        return sum + (Number.isFinite(amount) ? Math.abs(amount) : 0);
      }, 0));
    const netSales = orderCategory === "processingCompleted"
      ? Math.max(0, total - refundedTotal)
      : 0;
    const now = Timestamp.now();
    const createdAt = typeof order.date_created === "string" && !Number.isNaN(Date.parse(order.date_created))
      ? Timestamp.fromDate(new Date(order.date_created))
      : now;

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(orderRef);
      const existingStats = await transaction.get(statsRef);
      const previous = existing.data();
      const previousCurrency = previous?.currency;
      const previousNet = Number(previous?.netSales) || 0;
      const previousCategory = previous?.orderCategory;
      const statsData = existingStats.data() ?? {};

      const countDelta = (
        key: "processingCompletedOrders" | "otherStatusOrders" | "refundedOrders",
        category: "processingCompleted" | "other" | "refunded",
      ) =>
        Number(statsData[key] ?? 0) -
        (previousCategory === category ? 1 : 0) +
        (orderCategory === category ? 1 : 0);
      const salesByCurrency: Record<string, number> = {
        ...(statsData.netSalesByCurrency ?? {}),
      };
      if (previousCurrency) {
        salesByCurrency[previousCurrency] =
          Number(salesByCurrency[previousCurrency] ?? 0) -
          previousNet;
      }
      salesByCurrency[currency] =
        Number(salesByCurrency[currency] ?? 0) + netSales;

      transaction.set(orderRef, {
        orderId,
        orderNumber: typeof order.number === "string" || typeof order.number === "number"
          ? String(order.number).slice(0, 32)
          : orderId,
        status,
        orderCategory,
        total: total.toFixed(2),
        refundedTotal: refundedTotal.toFixed(2),
        netSales: netSales.toFixed(2),
        currency,
        createdAt,
        updatedAt: now,
      });
      transaction.set(statsRef, {
        processingCompletedOrders: countDelta("processingCompletedOrders", "processingCompleted"),
        otherStatusOrders: countDelta("otherStatusOrders", "other"),
        refundedOrders: countDelta("refundedOrders", "refunded"),
        netSalesByCurrency: salesByCurrency,
      });
    });

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("WooCommerce order webhook processing failed:", error);
    return NextResponse.json({ error: "Unable to process WooCommerce webhook" }, { status: 500 });
  }
}
