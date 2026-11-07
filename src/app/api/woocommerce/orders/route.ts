import { NextResponse } from "next/server";
import { admin, db } from "@/lib/firebase-admin";
import { OWNER_UID } from "@/lib/owner";

type OrderRecord = {
  orderId: string;
  status: string;
  orderCategory: string;
  total: string;
  currency: string;
  refundedTotal: string;
  createdAt: string | null;
  updatedAt: string | null;
  tenantId?: string;
};

function toOrderRecord(
  orderId: string,
  data: FirebaseFirestore.DocumentData,
  tenantId?: string,
): OrderRecord {
  return {
    orderId,
    status: data.status ?? "unknown",
    orderCategory: data.orderCategory ?? "other",
    total: data.total ?? "0",
    currency: data.currency ?? "",
    refundedTotal: data.refundedTotal ?? "0",
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    ...(tenantId && { tenantId }),
  };
}

async function getAuthenticatedUid(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  try {
    const user = await admin.auth().verifyIdToken(token);
    return user.uid;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const users = uid === OWNER_UID
      ? await db.collection("users").get()
      : await db.collection("users").doc(uid).get().then((user) => ({
          docs: user.exists ? [user] : [],
        }));

    const tenantResults = await Promise.all(users.docs.map(async (userDoc) => {
      const tenantRef = userDoc.ref;
      const [statsDoc, ordersSnapshot] = await Promise.all([
        tenantRef.collection("woocommerceStats").doc("summary").get(),
        tenantRef.collection("woocommerceOrders").orderBy("updatedAt", "desc").limit(25).get(),
      ]);
      const stats = statsDoc.data() ?? {};

      return {
        tenantId: userDoc.id,
        stats: {
          processingCompletedOrders: stats.processingCompletedOrders ?? 0,
          otherStatusOrders: stats.otherStatusOrders ?? 0,
          refundedOrders: stats.refundedOrders ?? 0,
          netSalesByCurrency: stats.netSalesByCurrency ?? {},
        },
        orders: ordersSnapshot.docs.map((order) =>
          toOrderRecord(order.id, order.data(), uid === OWNER_UID ? userDoc.id : undefined),
        ),
      };
    }));

    const orders = tenantResults.flatMap((tenant) => tenant.orders)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 25);

    if (uid !== OWNER_UID) {
      return NextResponse.json({
        tenantId: uid,
        stats: tenantResults[0]?.stats ?? {
          processingCompletedOrders: 0,
          otherStatusOrders: 0,
          refundedOrders: 0,
          netSalesByCurrency: {},
        },
        orders,
      });
    }

    const totals = tenantResults.reduce((result, tenant) => {
      result.processingCompletedOrders += tenant.stats.processingCompletedOrders;
      result.otherStatusOrders += tenant.stats.otherStatusOrders;
      result.refundedOrders += tenant.stats.refundedOrders;
      for (const [currency, amount] of Object.entries(tenant.stats.netSalesByCurrency)) {
        result.netSalesByCurrency[currency] =
          (result.netSalesByCurrency[currency] ?? 0) + Number(amount);
      }
      return result;
    }, {
      processingCompletedOrders: 0,
      otherStatusOrders: 0,
      refundedOrders: 0,
      netSalesByCurrency: {} as Record<string, number>,
    });

    return NextResponse.json({
      stats: totals,
      tenants: tenantResults.map(({ tenantId, stats }) => ({ tenantId, stats })),
      orders,
    });
  } catch (error) {
    console.error("WooCommerce orders query failed:", error);
    return NextResponse.json({ error: "Unable to load WooCommerce orders" }, { status: 500 });
  }
}
