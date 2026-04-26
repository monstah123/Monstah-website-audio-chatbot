import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");

    if (!userId) {
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    const settingsRef = db.collection("users").doc(userId);
    const doc = await settingsRef.get();

    let data = {
      agentName: "Monstah AI",
      systemPrompt: "You are a helpful and friendly customer service representative. Keep answers short and strictly based on the provided context.",
      firstMessage: "Hi! How can I help you today?",
      themeColor: "green",
      idleTimeout: 15,
      brandName: "Monstah AI",
      navigationLinks: []
    };

    if (doc.exists) {
      data = { ...data, ...doc.data() };
    }

    // Migrate legacy {name: url} object format → array format on the fly
    let navigationLinks: any[] = [];
    if (data.navigationLinks && !Array.isArray(data.navigationLinks)) {
      navigationLinks = Object.entries(data.navigationLinks).map(
        ([name, url]) => ({ name, url: url as string })
      );
    } else if (Array.isArray(data.navigationLinks)) {
      navigationLinks = data.navigationLinks;
    }

    // DISCOVER ALL UNIQUE LINKS FROM KNOWLEDGE BASE
    try {
      const knowledgeSnapshot = await db.collection("knowledge")
        .where("userId", "==", userId)
        .limit(5000) // Scan up to 5000 docs to ensure no product pages are missed
        .get();

      knowledgeSnapshot.forEach((doc: any) => {
        const kData = doc.data();
        if (kData.source) {
          const alreadyExists = navigationLinks.some((l: any) => l.url === kData.source);
          if (!alreadyExists) {
            const urlParts = kData.source.split('/');
            const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
            const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            navigationLinks.push({ name, url: kData.source });
          }
        }
      });
    } catch (e) {
      console.warn("Link discovery failed in settings:", e);
    }

    return NextResponse.json({
      ...data,
      navigationLinks
    });
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
    
    let processedLinks = [];
    if (navigationLinks !== undefined) {
      processedLinks = Array.isArray(navigationLinks)
        ? navigationLinks.filter((l: any) => l.name?.trim() && l.url?.trim())
        : [];
      updateData.navigationLinks = processedLinks;
    }

    if (quickLinks !== undefined) {
      updateData.quickLinks = Array.isArray(quickLinks)
        ? quickLinks.filter((q: any) => q.label?.trim() && q.action?.trim())
        : [];
    }

    // Save settings first
    await db.collection("users").doc(userId).set(updateData, { merge: true });

    // BACKGROUND AUTO-TRAINING: Check if any new navigation links need training
    if (processedLinks.length > 0) {
      // Trigger training in background (non-blocking for better UI response)
      (async () => {
        for (const link of processedLinks) {
          try {
            // 1. Check if we already have content for this URL
            const existing = await db.collection("knowledge")
              .where("userId", "==", userId)
              .where("source", "==", link.url)
              .limit(1)
              .get();

            if (existing.empty) {
              console.log(`[Auto-Training] Learning new page: ${link.url}`);
              
              // 2. Scrape content
              const response = await fetch(link.url);
              if (!response.ok) continue;
              const html = await response.text();
              const $ = cheerio.load(html);
              $("script, style, noscript, nav, footer").remove();
              const content = $("body").text().replace(/\s+/g, " ").trim();

              if (content.length > 10) {
                // 3. Generate Embedding
                const embeddingResponse = await openai.embeddings.create({
                  model: "text-embedding-3-small",
                  input: content.substring(0, 8000), // Safety cap for tokens
                });
                const vector = embeddingResponse.data[0].embedding;

                // 4. Store in knowledge base
                await db.collection("knowledge").add({
                  userId,
                  source: link.url,
                  content: content.substring(0, 5000), // Just enough for context
                  vector,
                  createdAt: new Date().toISOString(),
                });
                console.log(`[Auto-Training] Success: ${link.url}`);
              }
            }
          } catch (e) {
            console.error(`[Auto-Training] Failed for ${link.url}:`, e);
          }
        }
      })();
    }

    return NextResponse.json({ success: true, message: "Settings saved & auto-training triggered!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
