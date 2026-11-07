import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import {
  encryptShopifyToken,
  getShopifyAppConfig,
  isValidShopDomain,
  registerShopifyOrderWebhooks,
  SHOPIFY_SCOPES,
  verifyShopifyQueryHmac,
} from "@/lib/shopify";

export const runtime = "nodejs";

function dashboardRedirect(appUrl: string, result: string, shop?: string) {
  const redirect = new URL("/dashboard", appUrl);
  redirect.searchParams.set("shopify", result);
  if (shop) redirect.searchParams.set("shop", shop);
  return NextResponse.redirect(redirect);
}

export async function GET(request: Request) {
  const config = getShopifyAppConfig();
  if (!config) {
    return NextResponse.json({ error: "Shopify app credentials are not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const shop = params.get("shop")?.toLowerCase() ?? "";
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  if (!verifyShopifyQueryHmac(params, config.apiSecret) || !isValidShopDomain(shop) || !state || !code) {
    return NextResponse.json({ error: "Invalid Shopify authorization callback" }, { status: 400 });
  }

  try {
    const stateRef = db.collection("shopifyOAuthStates").doc(state);
    const stateData = await db.runTransaction(async (transaction) => {
      const stateDoc = await transaction.get(stateRef);
      const data = stateDoc.data();
      const createdAt = Number(data?.createdAt);
      if (
        !stateDoc.exists ||
        data?.shop !== shop ||
        typeof data?.uid !== "string" ||
        !Number.isFinite(createdAt) ||
        Date.now() - createdAt > 10 * 60 * 1000
      ) {
        return null;
      }
      transaction.delete(stateRef);
      return data;
    });
    if (!stateData) {
      return NextResponse.json({ error: "Shopify authorization expired. Please reconnect." }, { status: 400 });
    }
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        code,
        expiring: "1",
      }),
    });
    if (!tokenResponse.ok) {
      console.error("Shopify OAuth token exchange failed:", tokenResponse.status);
      return dashboardRedirect(config.appUrl, "token_error", shop);
    }
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      console.error("Shopify OAuth token response did not contain an access token");
      return dashboardRedirect(config.appUrl, "token_error", shop);
    }
    if (
      typeof tokenData.refresh_token !== "string" ||
      !Number.isFinite(Number(tokenData.expires_in)) ||
      !Number.isFinite(Number(tokenData.refresh_token_expires_in)) ||
      typeof tokenData.scope !== "string"
    ) {
      console.error("Shopify OAuth response did not include required expiring-token metadata");
      return dashboardRedirect(config.appUrl, "token_error", shop);
    }

    const grantedScopes = tokenData.scope.split(",").map((scope: string) => scope.trim());
    const missingScopes = SHOPIFY_SCOPES.split(",").filter((scope) =>
      !grantedScopes.includes(scope) &&
      !(scope.startsWith("read_") && grantedScopes.includes(`write_${scope.slice(5)}`)),
    );
    if (missingScopes.length) {
      console.error("Shopify OAuth did not grant required scopes:", missingScopes.join(","));
      return dashboardRedirect(config.appUrl, "scope_error", shop);
    }

    const tenantId = stateData.uid;
    const connectionRef = db.collection("shopifyConnections").doc(tenantId);
    await connectionRef.set({
      shop,
      ...encryptShopifyToken(tokenData.access_token, tokenData.refresh_token),
      scopes: grantedScopes,
      accessTokenExpiresAt: Date.now() + Number(tokenData.expires_in) * 1000,
      refreshTokenExpiresAt: Date.now() + Number(tokenData.refresh_token_expires_in) * 1000,
      connectedAt: new Date().toISOString(),
      webhookStatus: "pending",
    });

    try {
      await registerShopifyOrderWebhooks(shop, tokenData.access_token, tenantId, config.appUrl);
      await connectionRef.update({ webhookStatus: "active", webhookError: null });
      return dashboardRedirect(config.appUrl, "connected", shop);
    } catch (error) {
      console.error("Shopify webhook registration failed:", error);
      await connectionRef.update({
        webhookStatus: "error",
        webhookError: error instanceof Error ? error.message.slice(0, 300) : "Webhook registration failed",
      });
      return dashboardRedirect(config.appUrl, "webhook_error", shop);
    }
  } catch (error) {
    console.error("Shopify OAuth callback failed:", error);
    return dashboardRedirect(config.appUrl, "error", shop);
  }
}
