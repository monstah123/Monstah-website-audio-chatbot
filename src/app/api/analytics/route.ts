import { NextResponse } from "next/server";
import { admin, db } from "@/lib/firebase-admin";
import { OWNER_UID } from "@/lib/owner";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let requesterUid: string;
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    requesterUid = decodedToken.uid;
  } catch (error) {
    console.warn("Analytics request had an invalid authentication token:", error);
    return NextResponse.json({ error: "Invalid authentication token" }, { status: 401 });
  }

  try {
    const day = new Date().toISOString().slice(0, 10);
    if (requesterUid !== OWNER_UID) {
      const tenantRef = db.collection("users").doc(requesterUid);
      const [metricsDoc, sitesSnapshot, purchasesSnapshot] = await Promise.all([
        tenantRef.collection("analyticsDays").doc(day).get(),
        tenantRef.collection("analyticsSites").get(),
        tenantRef.collection("analyticsPurchases").orderBy("createdAt", "desc").limit(25).get(),
      ]);
      const metrics = metricsDoc.data() ?? {};
      const sites = await Promise.all(sitesSnapshot.docs.map(async (siteDoc) => {
        const siteMetricsDoc = await siteDoc.ref.collection("analyticsDays").doc(day).get();
        const siteMetrics = siteMetricsDoc.data() ?? {};
        return {
          tenantId: requesterUid,
          siteId: siteDoc.id,
          websiteOrigin: siteDoc.data().websiteOrigin ?? "",
          metrics: {
            pageViews: siteMetrics.pageViews ?? 0,
            uniqueSessions: siteMetrics.uniqueSessions ?? 0,
            chatsOpened: siteMetrics.chatsOpened ?? 0,
            userMessages: siteMetrics.userMessages ?? 0,
            assistantResponses: siteMetrics.assistantResponses ?? 0,
            navigations: siteMetrics.navigations ?? 0,
            conversions: siteMetrics.conversions ?? 0,
            woocommercePurchases: siteMetrics.woocommercePurchases ?? 0,
          },
        };
      }));

      return NextResponse.json({
        day,
        metrics: {
          pageViews: metrics.pageViews ?? 0,
          uniqueSessions: metrics.uniqueSessions ?? 0,
          chatsOpened: metrics.chatsOpened ?? 0,
          userMessages: metrics.userMessages ?? 0,
          assistantResponses: metrics.assistantResponses ?? 0,
          navigations: metrics.navigations ?? 0,
          conversions: metrics.conversions ?? 0,
          woocommercePurchases: metrics.woocommercePurchases ?? 0,
        },
        sites,
        recentPurchases: purchasesSnapshot.docs.map((purchase) => {
          const data = purchase.data();
          return {
            orderId: data.orderId,
            websiteOrigin: data.websiteOrigin,
            purchasedAt: data.createdAt?.toDate?.().toISOString() ?? null,
          };
        }),
      });
    }

    const userSnapshot = await db.collection("users").get();
    const tenants = await Promise.all(userSnapshot.docs.map(async (userDoc) => {
      const tenantRef = userDoc.ref;
      const [metricsDoc, sitesSnapshot, purchasesSnapshot] = await Promise.all([
        tenantRef.collection("analyticsDays").doc(day).get(),
        tenantRef.collection("analyticsSites").get(),
        tenantRef.collection("analyticsPurchases").orderBy("createdAt", "desc").limit(25).get(),
      ]);
      const metrics = metricsDoc.data() ?? {};
      const sites = await Promise.all(sitesSnapshot.docs.map(async (siteDoc) => {
        const siteMetricsDoc = await siteDoc.ref.collection("analyticsDays").doc(day).get();
        const siteMetrics = siteMetricsDoc.data() ?? {};
        return {
          siteId: siteDoc.id,
          websiteOrigin: siteDoc.data().websiteOrigin ?? "",
          metrics: {
            pageViews: siteMetrics.pageViews ?? 0,
            uniqueSessions: siteMetrics.uniqueSessions ?? 0,
            chatsOpened: siteMetrics.chatsOpened ?? 0,
            userMessages: siteMetrics.userMessages ?? 0,
            assistantResponses: siteMetrics.assistantResponses ?? 0,
            navigations: siteMetrics.navigations ?? 0,
            conversions: siteMetrics.conversions ?? 0,
            woocommercePurchases: siteMetrics.woocommercePurchases ?? 0,
          },
        };
      }));

      return {
        tenantId: userDoc.id,
        metrics,
        sites,
        purchases: purchasesSnapshot.docs.map((purchase) => {
          const data = purchase.data();
          return {
            orderId: data.orderId,
            websiteOrigin: data.websiteOrigin,
            purchasedAt: data.createdAt?.toDate?.().toISOString() ?? null,
          };
        }),
      };
    }));

    const totals = tenants.reduce((result, tenant) => ({
      pageViews: result.pageViews + (tenant.metrics.pageViews ?? 0),
      uniqueSessions: result.uniqueSessions + (tenant.metrics.uniqueSessions ?? 0),
      chatsOpened: result.chatsOpened + (tenant.metrics.chatsOpened ?? 0),
      userMessages: result.userMessages + (tenant.metrics.userMessages ?? 0),
      assistantResponses: result.assistantResponses + (tenant.metrics.assistantResponses ?? 0),
      navigations: result.navigations + (tenant.metrics.navigations ?? 0),
      conversions: result.conversions + (tenant.metrics.conversions ?? 0),
      woocommercePurchases: result.woocommercePurchases + (tenant.metrics.woocommercePurchases ?? 0),
    }), {
      pageViews: 0,
      uniqueSessions: 0,
      chatsOpened: 0,
      userMessages: 0,
      assistantResponses: 0,
      navigations: 0,
      conversions: 0,
      woocommercePurchases: 0,
    });

    const sites = tenants.flatMap((tenant) =>
      tenant.sites.map((site) => ({ tenantId: tenant.tenantId, ...site })),
    );
    const recentPurchases = tenants.flatMap((tenant) => tenant.purchases)
      .sort((a, b) => (b.purchasedAt ?? "").localeCompare(a.purchasedAt ?? ""))
      .slice(0, 25);

    return NextResponse.json({
      day,
      metrics: totals,
      tenants: tenants.map(({ tenantId, metrics }) => ({
        tenantId,
        metrics: {
          pageViews: metrics.pageViews ?? 0,
          uniqueSessions: metrics.uniqueSessions ?? 0,
          chatsOpened: metrics.chatsOpened ?? 0,
          userMessages: metrics.userMessages ?? 0,
          assistantResponses: metrics.assistantResponses ?? 0,
          navigations: metrics.navigations ?? 0,
          conversions: metrics.conversions ?? 0,
          woocommercePurchases: metrics.woocommercePurchases ?? 0,
        },
      })),
      sites,
      recentPurchases,
    });
  } catch (error) {
    console.error("Analytics metrics query failed:", error);
    return NextResponse.json({ error: "Unable to load analytics" }, { status: 500 });
  }
}
