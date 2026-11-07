import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { OWNER_UID } from "@/lib/owner";
import {
  getAuthenticatedUid,
  getShopifyAccessToken,
  getShopifyAppConfig,
  registerShopifyOrderWebhooks,
} from "@/lib/shopify";

type ShopifyOrderRecord = {
  orderId: string;
  orderNumber: string;
  status: string;
  orderCategory: string;
  total: string;
  refundedTotal: string;
  currency: string;
  createdAt: string | null;
  updatedAt: string | null;
  tenantId?: string;
};

function serializeOrder(
  id: string,
  data: FirebaseFirestore.DocumentData,
  tenantId?: string,
): ShopifyOrderRecord {
  return {
    orderId: id,
    orderNumber: data.orderNumber ?? id,
    status: data.status ?? "unknown",
    orderCategory: data.orderCategory ?? "other",
    total: data.total ?? "0",
    refundedTotal: data.refundedTotal ?? "0",
    currency: data.currency ?? "",
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    ...(tenantId ? { tenantId } : {}),
  };
}

async function setupWebhooks(uid: string) {
  const config = getShopifyAppConfig();
  if (!config) {
    return NextResponse.json({ error: "Shopify app credentials are not configured in Vercel." }, { status: 503 });
  }
  const connectionRef = db.collection("shopifyConnections").doc(uid);
  const connection = await connectionRef.get();
  if (!connection.exists) {
    return NextResponse.json({ error: "Connect a Shopify store first." }, { status: 409 });
  }
  const data = connection.data()!;
  try {
    const accessToken = await getShopifyAccessToken(uid, data);
    await registerShopifyOrderWebhooks(data.shop, accessToken, uid, config.appUrl);
    await connectionRef.update({ webhookStatus: "active", webhookError: null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Shopify webhook retry failed:", error);
    await connectionRef.update({
      webhookStatus: "error",
      webhookError: error instanceof Error ? error.message.slice(0, 300) : "Webhook registration failed",
    });
    return NextResponse.json({ error: "Could not register Shopify order webhooks." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const isOwner = uid === OWNER_UID;
    const userDocs = isOwner
      ? await db.collection("users").get()
      : await db.collection("users").doc(uid).get().then((doc) => ({ docs: doc.exists ? [doc] : [] }));
    const tenantResults = await Promise.all(userDocs.docs.map(async (userDoc) => {
      const tenantRef = userDoc.ref;
      const [connection, statsDoc, ordersSnapshot] = await Promise.all([
        db.collection("shopifyConnections").doc(userDoc.id).get(),
        tenantRef.collection("shopifyStats").doc("summary").get(),
        tenantRef.collection("shopifyOrders").orderBy("updatedAt", "desc").limit(25).get(),
      ]);
      const stats = statsDoc.data() ?? {};
      return {
        tenantId: userDoc.id,
        connected: connection.exists,
        appReady: Boolean(getShopifyAppConfig()),
        shop: connection.data()?.shop ?? null,
        webhookStatus: connection.data()?.webhookStatus ?? null,
        stats: {
          processingCompletedOrders: stats.processingCompletedOrders ?? 0,
          otherStatusOrders: stats.otherStatusOrders ?? 0,
          refundedOrders: stats.refundedOrders ?? 0,
          netSalesByCurrency: stats.netSalesByCurrency ?? {},
        },
        orders: ordersSnapshot.docs.map((order) =>
          serializeOrder(order.id, order.data(), isOwner ? userDoc.id : undefined),
        ),
      };
    }));

    if (!isOwner) {
      const tenant = tenantResults[0];
      return NextResponse.json({
        connected: tenant?.connected ?? false,
        appReady: Boolean(getShopifyAppConfig()),
        shop: tenant?.shop ?? null,
        webhookStatus: tenant?.webhookStatus ?? null,
        stats: tenant?.stats ?? {
          processingCompletedOrders: 0,
          otherStatusOrders: 0,
          refundedOrders: 0,
          netSalesByCurrency: {},
        },
        orders: tenant?.orders ?? [],
      });
    }

    const stats = tenantResults.reduce((total, tenant) => {
      total.processingCompletedOrders += tenant.stats.processingCompletedOrders;
      total.otherStatusOrders += tenant.stats.otherStatusOrders;
      total.refundedOrders += tenant.stats.refundedOrders;
      for (const [currency, amount] of Object.entries(tenant.stats.netSalesByCurrency)) {
        total.netSalesByCurrency[currency] =
          (total.netSalesByCurrency[currency] ?? 0) + Number(amount);
      }
      return total;
    }, {
      processingCompletedOrders: 0,
      otherStatusOrders: 0,
      refundedOrders: 0,
      netSalesByCurrency: {} as Record<string, number>,
    });
    const orders = tenantResults.flatMap((tenant) => tenant.orders)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 25);

    return NextResponse.json({
      connected: tenantResults.some((tenant) => tenant.connected),
      appReady: Boolean(getShopifyAppConfig()),
      stats,
      tenants: tenantResults.map(({ tenantId, connected, shop, webhookStatus, stats: tenantStats }) => ({
        tenantId,
        connected,
        shop,
        webhookStatus,
        stats: tenantStats,
      })),
      orders,
    });
  } catch (error) {
    console.error("Shopify order report query failed:", error);
    return NextResponse.json({ error: "Unable to load Shopify report" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let action: unknown;
  try {
    ({ action } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (action !== "retry-webhooks") {
    return NextResponse.json({ error: "Unsupported Shopify report action" }, { status: 400 });
  }
  return setupWebhooks(uid);
}
