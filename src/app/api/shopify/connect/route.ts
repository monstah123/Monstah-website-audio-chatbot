import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import {
  configurationErrorResponse,
  getAuthenticatedUid,
  getShopifyAppConfig,
  isValidShopDomain,
  SHOPIFY_SCOPES,
} from "@/lib/shopify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const config = getShopifyAppConfig();
  if (!config) return configurationErrorResponse();

  let shop: unknown;
  try {
    ({ shop } = await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid Shopify store domain" }, { status: 400 });
  }
  if (typeof shop !== "string") {
    return NextResponse.json({ error: "Enter a valid Shopify store domain" }, { status: 400 });
  }
  const normalizedShop = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!isValidShopDomain(normalizedShop)) {
    return NextResponse.json({
      error: "Enter your Shopify myshopify.com domain (for example, store-name.myshopify.com).",
    }, { status: 400 });
  }

  try {
    const existingConnection = await db.collection("shopifyConnections").doc(uid).get();
    if (existingConnection.exists && existingConnection.data()?.shop !== normalizedShop) {
      return NextResponse.json({
        error: "This account already has a Shopify store connected. Disconnect that store before connecting another.",
      }, { status: 409 });
    }

    const state = randomBytes(32).toString("hex");
    await db.collection("shopifyOAuthStates").doc(state).create({
      uid,
      shop: normalizedShop,
      createdAt: Date.now(),
    });
    const redirectUri = `${config.appUrl}/api/shopify/callback`;
    const authorizationUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    authorizationUrl.search = new URLSearchParams({
      client_id: config.apiKey,
      scope: SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
    }).toString();

    return NextResponse.json({ authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error("Shopify OAuth start failed:", error);
    return NextResponse.json({ error: "Unable to start Shopify connection" }, { status: 500 });
  }
}
