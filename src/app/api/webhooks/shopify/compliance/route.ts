import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getShopifyAppConfig, verifyShopifyWebhookHmac } from "@/lib/shopify";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const COMPLIANCE_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Webhook body is required" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
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
    console.error("Unable to read Shopify compliance webhook:", error);
    return NextResponse.json({ error: "Unable to read webhook body" }, { status: 400 });
  }

  const rawBody = Buffer.concat(chunks);
  const config = getShopifyAppConfig();
  const signature = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");
  const shop = request.headers.get("x-shopify-shop-domain")?.toLowerCase();
  if (!config || !signature || !topic || !shop || !COMPLIANCE_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Invalid Shopify compliance webhook headers" }, { status: 400 });
  }
  if (!verifyShopifyWebhookHmac(rawBody, signature, config.apiSecret)) {
    return NextResponse.json({ error: "Invalid Shopify webhook signature" }, { status: 401 });
  }

  try {
    JSON.parse(rawBody.toString("utf8"));
    if (topic === "shop/redact") {
      const connections = await db.collection("shopifyConnections").where("shop", "==", shop).get();
      await Promise.all(connections.docs.map(async (connection) => {
        const tenantRef = db.collection("users").doc(connection.id);
        await Promise.all([
          db.recursiveDelete(tenantRef.collection("shopifyOrders")),
          db.recursiveDelete(tenantRef.collection("shopifyStats")),
          connection.ref.delete(),
        ]);
      }));
    }

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("Shopify compliance webhook processing failed:", error);
    return NextResponse.json({ error: "Unable to process Shopify compliance webhook" }, { status: 500 });
  }
}
