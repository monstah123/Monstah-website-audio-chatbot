import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { admin, db } from "@/lib/firebase-admin";
import { encryptWooCommerceSecret } from "@/lib/woocommerce-secret";

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
    const integration = await db.collection("woocommerceWebhookSecrets").doc(uid).get();

    return NextResponse.json({
      configured: Boolean(integration.data()?.encryptedSecret),
      webhookUrl: `${new URL(request.url).origin}/api/webhooks/woocommerce/${uid}`,
    });
  } catch (error) {
    console.error("WooCommerce integration status lookup failed:", error);
    return NextResponse.json({ error: "Unable to load WooCommerce integration" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const webhookSecret = randomBytes(32).toString("hex");
    const webhookUrl = `${new URL(request.url).origin}/api/webhooks/woocommerce/${uid}`;
    await db.collection("woocommerceWebhookSecrets").doc(uid).set({
      ...encryptWooCommerceSecret(webhookSecret),
      webhookUrl,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ webhookUrl, webhookSecret });
  } catch (error) {
    console.error("WooCommerce webhook setup failed:", error);
    return NextResponse.json({ error: "Unable to configure WooCommerce webhook" }, { status: 500 });
  }
}
