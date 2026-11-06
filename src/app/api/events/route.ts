import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

const eventTypes = [
  "widget_loaded",
  "chat_opened",
  "chat_closed",
  "user_message",
  "assistant_response",
  "navigation",
  "conversion",
] as const;

type EventType = (typeof eventTypes)[number];

function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (eventTypes as readonly string[]).includes(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function getSafePagePath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 500) {
    return "/";
  }

  return value.split(/[?#]/, 1)[0] || "/";
}

function getSafeOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length > 500) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  const {
    tenantId,
    sessionId,
    eventId,
    type,
    pagePath,
    websiteOrigin,
    label,
    destination,
    orderId,
  } = payload as Record<string, unknown>;

  if (
    !isSafeId(tenantId) ||
    !isSafeId(sessionId) ||
    !isSafeId(eventId) ||
    !isEventType(type)
  ) {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  try {
    const tenantRef = db.collection("users").doc(tenantId);
    const day = new Date().toISOString().slice(0, 10);
    const dayRef = tenantRef.collection("analyticsDays").doc(day);
    const sessionRef = tenantRef.collection("analyticsSessions").doc(`${day}_${sessionId}`);
    const safeOrigin = getSafeOrigin(websiteOrigin);
    const safeLabel = typeof label === "string" ? label.trim().slice(0, 80) : "";
    const safeOrderId =
      typeof orderId === "string" && /^\d{1,32}$/.test(orderId) ? orderId : "";
    const siteId = safeOrigin
      ? createHash("sha256").update(safeOrigin).digest("hex")
      : "";
    const isWooCommercePurchase =
      type === "conversion" &&
      safeLabel === "woocommerce_purchase" &&
      safeOrderId !== "" &&
      safeOrigin !== "" &&
      eventId === `woocommerce_order_${safeOrderId}`;
    const purchaseKey = isWooCommercePurchase
      ? createHash("sha256").update(`${siteId}:${safeOrderId}`).digest("hex")
      : "";
    const eventRef = tenantRef
      .collection("analyticsEvents")
      .doc(isWooCommercePurchase ? `woocommerce_${purchaseKey}` : eventId);
    let safeDestination = "";

    if (type === "navigation" && typeof destination === "string") {
      try {
        const url = new URL(destination);
        if (url.protocol === "http:" || url.protocol === "https:") {
          safeDestination = `${url.origin}${url.pathname}`.slice(0, 500);
        }
      } catch {
        safeDestination = "";
      }
    }

    const counters: Record<string, FieldValue> = {
      events: FieldValue.increment(1),
    };
    const siteCounters: Record<string, FieldValue> = {
      events: FieldValue.increment(1),
    };
    if (type === "widget_loaded") counters.pageViews = FieldValue.increment(1);
    if (type === "widget_loaded") siteCounters.pageViews = FieldValue.increment(1);
    if (type === "chat_opened") {
      counters.chatsOpened = FieldValue.increment(1);
      siteCounters.chatsOpened = FieldValue.increment(1);
    }
    if (type === "user_message") {
      counters.userMessages = FieldValue.increment(1);
      siteCounters.userMessages = FieldValue.increment(1);
    }
    if (type === "assistant_response") {
      counters.assistantResponses = FieldValue.increment(1);
      siteCounters.assistantResponses = FieldValue.increment(1);
    }
    if (type === "navigation") {
      counters.navigations = FieldValue.increment(1);
      siteCounters.navigations = FieldValue.increment(1);
    }
    if (type === "conversion") {
      counters.conversions = FieldValue.increment(1);
      siteCounters.conversions = FieldValue.increment(1);
      if (isWooCommercePurchase) {
        counters.woocommercePurchases = FieldValue.increment(1);
        siteCounters.woocommercePurchases = FieldValue.increment(1);
      }
    }
    const siteRef = siteId ? tenantRef.collection("analyticsSites").doc(siteId) : null;
    const siteDayRef = siteRef?.collection("analyticsDays").doc(day) ?? null;
    const siteSessionRef = siteRef?.collection("analyticsSessions").doc(`${day}_${sessionId}`) ?? null;

    await db.runTransaction(async (transaction) => {
      const existingEvent = await transaction.get(eventRef);
      if (existingEvent.exists) {
        return;
      }

      const [sessionSnapshot, siteSessionSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        siteSessionRef ? transaction.get(siteSessionRef) : Promise.resolve(null),
      ]);
      if (!sessionSnapshot.exists) {
        counters.uniqueSessions = FieldValue.increment(1);
      }
      if (siteSessionSnapshot && !siteSessionSnapshot.exists) {
        siteCounters.uniqueSessions = FieldValue.increment(1);
      }

      const eventData = {
        tenantId,
        sessionId,
        type,
        websiteOrigin: safeOrigin,
        pagePath: getSafePagePath(pagePath),
        ...(safeLabel && { label: safeLabel }),
        ...(safeDestination && { destination: safeDestination }),
        ...(siteId && { siteId }),
        createdAt: Timestamp.now(),
      };

      transaction.create(eventRef, {
        ...eventData,
        ...(isWooCommercePurchase && { orderId: safeOrderId }),
      });
      if (siteRef && siteDayRef && siteSessionRef) {
        transaction.set(siteRef, { websiteOrigin: safeOrigin }, { merge: true });
        transaction.set(
          siteDayRef,
          { ...siteCounters, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        transaction.set(siteSessionRef, { firstSeenAt: Timestamp.now() }, { merge: true });
      }
      if (isWooCommercePurchase) {
        transaction.create(tenantRef.collection("analyticsPurchases").doc(purchaseKey), {
          orderId: safeOrderId,
          sessionId,
          websiteOrigin: safeOrigin,
          siteId,
          createdAt: eventData.createdAt,
        });
      }
      transaction.set(sessionRef, { firstSeenAt: Timestamp.now() }, { merge: true });
      transaction.set(
        dayRef,
        { ...counters, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("Analytics event ingestion failed:", error);
    return NextResponse.json({ error: "Unable to record analytics event" }, { status: 500 });
  }
}
