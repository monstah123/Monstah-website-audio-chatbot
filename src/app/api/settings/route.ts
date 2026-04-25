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
        agentName: "Peterson",
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
      brandName,
      navigationLinks,   // expected as array: [{ name, url }]
    } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing User ID" }, { status: 401 });
    }

    // Validate navigationLinks is an array and filter out empty rows
    const cleanLinks: { name: string; url: string }[] = Array.isArray(navigationLinks)
      ? navigationLinks.filter((l: any) => l.name?.trim() && l.url?.trim())
      : [];

    await db.collection("users").doc(userId).set({
      agentName,
      systemPrompt,
      firstMessage,
      themeColor,
      idleTimeout: idleTimeout ?? 15,
      brandName: brandName || "Monstah AI",
      navigationLinks: cleanLinks,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: "Settings saved successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
