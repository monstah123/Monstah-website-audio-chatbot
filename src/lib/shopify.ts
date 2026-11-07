import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { NextResponse } from "next/server";
import { admin, db } from "@/lib/firebase-admin";

export const SHOPIFY_API_VERSION = "2026-10";
export const SHOPIFY_SCOPES = "read_orders";

type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

type EncryptedToken = {
  encryptedAccessToken: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
  encryptedRefreshToken: string;
  refreshTokenIv: string;
  refreshTokenAuthTag: string;
};

export function getShopifyAppConfig() {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/+$/, "");
  if (!apiKey || !apiSecret || !appUrl) return null;

  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
  return { apiKey, apiSecret, appUrl: url.origin };
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

export async function getAuthenticatedUid(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  try {
    return (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

function shopifyEncryptionKey() {
  const config = getShopifyAppConfig();
  if (!config) throw new Error("Shopify app credentials are not configured");
  return createHash("sha256").update("shopify-token:v1:").update(config.apiSecret).digest();
}

function encryptCredential(value: string): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", shopifyEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptCredential(data: Partial<EncryptedCredential>): string {
  if (!data.ciphertext || !data.iv || !data.authTag) {
    throw new Error("Shopify connection token is incomplete");
  }
  const decipher = createDecipheriv("aes-256-gcm", shopifyEncryptionKey(), Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptShopifyToken(accessToken: string, refreshToken: string): EncryptedToken {
  const encryptedAccess = encryptCredential(accessToken);
  const encryptedRefresh = encryptCredential(refreshToken);
  return {
    encryptedAccessToken: encryptedAccess.ciphertext,
    accessTokenIv: encryptedAccess.iv,
    accessTokenAuthTag: encryptedAccess.authTag,
    encryptedRefreshToken: encryptedRefresh.ciphertext,
    refreshTokenIv: encryptedRefresh.iv,
    refreshTokenAuthTag: encryptedRefresh.authTag,
  };
}

export async function getShopifyAccessToken(
  tenantId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<string> {
  const expiresAt = Number(data.accessTokenExpiresAt);
  const accessTokenData = {
    ciphertext: data.encryptedAccessToken,
    iv: data.accessTokenIv,
    authTag: data.accessTokenAuthTag,
  };
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 5 * 60 * 1000) {
    return decryptCredential(accessTokenData);
  }

  const config = getShopifyAppConfig();
  if (!config) throw new Error("Shopify app credentials are not configured");
  const refreshToken = decryptCredential({
    ciphertext: data.encryptedRefreshToken,
    iv: data.refreshTokenIv,
    authTag: data.refreshTokenAuthTag,
  });
  const response = await fetch(`https://${data.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`Shopify token refresh failed (${response.status})`);
  const refreshed = await response.json();
  if (
    typeof refreshed.access_token !== "string" ||
    typeof refreshed.refresh_token !== "string" ||
    !Number.isFinite(Number(refreshed.expires_in)) ||
    !Number.isFinite(Number(refreshed.refresh_token_expires_in))
  ) {
    throw new Error("Shopify token refresh returned incomplete credentials");
  }

  const refreshedToken = encryptShopifyToken(refreshed.access_token, refreshed.refresh_token);
  await db.collection("shopifyConnections").doc(tenantId).update({
    ...refreshedToken,
    accessTokenExpiresAt: Date.now() + Number(refreshed.expires_in) * 1000,
    refreshTokenExpiresAt: Date.now() + Number(refreshed.refresh_token_expires_in) * 1000,
  });
  return refreshed.access_token;
}

export function verifyShopifyQueryHmac(params: URLSearchParams, apiSecret: string): boolean {
  const supplied = params.get("hmac");
  if (!supplied || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = createHmac("sha256", apiSecret).update(message).digest();
  const received = Buffer.from(supplied, "hex");
  return digest.length === received.length && timingSafeEqual(digest, received);
}

export function verifyShopifyWebhookHmac(rawBody: Buffer, signature: string, apiSecret: string): boolean {
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", apiSecret).update(rawBody).digest();
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function registerShopifyOrderWebhooks(
  shop: string,
  accessToken: string,
  tenantId: string,
  appUrl: string,
) {
  const endpoint = `${appUrl}/api/webhooks/shopify/${tenantId}`;
  const apiUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const query = `query {
    webhookSubscriptions(first: 100) {
      edges {
        node {
          topic
          uri
        }
      }
    }
  }`;
  const existingResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query }),
  });
  if (!existingResponse.ok) {
    throw new Error(`Shopify webhook lookup failed (${existingResponse.status})`);
  }
  const existingJson = await existingResponse.json();
  if (existingJson.errors?.length) {
    throw new Error(existingJson.errors.map((error: { message?: string }) => error.message).join("; "));
  }
  const existing = new Set<string>(
    (existingJson.data?.webhookSubscriptions?.edges ?? [])
      .map((edge: { node?: { topic?: string; uri?: string } }) =>
        `${edge.node?.topic}:${edge.node?.uri}`,
      ),
  );

  for (const topic of ["ORDERS_CREATE", "ORDERS_UPDATED", "APP_UNINSTALLED"]) {
    if (existing.has(`${topic}:${endpoint}`)) continue;
    const mutation = `mutation CreateOrderWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          topic,
          subscription: { uri: endpoint, format: "JSON" },
        },
      }),
    });
    if (!response.ok) throw new Error(`Shopify ${topic} webhook registration failed (${response.status})`);
    const result = await response.json();
    const creation = result.data?.webhookSubscriptionCreate;
    const errors = [...(result.errors ?? []), ...(creation?.userErrors ?? [])];
    if (errors.length) {
      throw new Error(errors.map((error: { message?: string }) => error.message).join("; "));
    }
    if (!creation?.webhookSubscription?.id) {
      throw new Error(`Shopify did not confirm the ${topic} webhook subscription`);
    }
  }
}

export function configurationErrorResponse() {
  return NextResponse.json({
    error: "Shopify connection is not enabled yet. The app owner must add Shopify app credentials and SHOPIFY_APP_URL in Vercel.",
  }, { status: 503 });
}
