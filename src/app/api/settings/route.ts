import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");

    if (!userId) {
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    const settingsRef = db.collection("users").doc(userId);
    const doc = await settingsRef.get();

    if (!doc.exists) {
      return NextResponse.json({
        agentName: "Monstah AI",
        systemPrompt: "You are a helpful and friendly customer service representative. Keep answers short and strictly based on the provided context.",
        firstMessage: "Hi! How can I help you today?",
        themeColor: "green",
        idleTimeout: 15,
        brandName: "Monstah AI",
        navigationLinks: [],   // array format: [{ name, url }]
      });
    }

    const data = doc.data()!;

    // Migrate legacy {name: url} object format → array format on the fly
    if (data.navigationLinks && !Array.isArray(data.navigationLinks)) {
      data.navigationLinks = Object.entries(data.navigationLinks).map(
        ([name, url]) => ({ name, url })
      );
    } else if (!data.navigationLinks) {
      data.navigationLinks = [];
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const {
      userId,
      agentName,
      systemPrompt,
      firstMessage,
      themeColor,
      idleTimeout,
      trainingSchedule,
      lastTrainedUrl,
      brandName,
      navigationLinks,   // expected as array: [{ name, url }]
      quickLinks,        // expected as array: [{ label, action }]
    } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing User ID" }, { status: 401 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (agentName !== undefined) updateData.agentName = agentName;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (firstMessage !== undefined) updateData.firstMessage = firstMessage;
    if (themeColor !== undefined) updateData.themeColor = themeColor;
    if (idleTimeout !== undefined) updateData.idleTimeout = idleTimeout;
    if (trainingSchedule !== undefined) updateData.trainingSchedule = trainingSchedule;
    if (lastTrainedUrl !== undefined) updateData.lastTrainedUrl = lastTrainedUrl;
    if (brandName !== undefined) updateData.brandName = brandName || "Monstah AI";
    
    if (navigationLinks !== undefined) {
      updateData.navigationLinks = Array.isArray(navigationLinks)
        ? navigationLinks.filter((l: any) => l.name?.trim() && l.url?.trim())
        : [];
    }

    if (quickLinks !== undefined) {
      updateData.quickLinks = Array.isArray(quickLinks)
        ? quickLinks.filter((q: any) => q.label?.trim() && q.action?.trim())
        : [];
    }

    await db.collection("users").doc(userId).set(updateData, { merge: true });

    return NextResponse.json({ success: true, message: "Settings saved successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
