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

    // AUTO-CLEANUP: Delete knowledge chunks for URLs that were removed from the UI
    // ONLY run cleanup if navigationLinks was explicitly provided in the payload
    if (navigationLinks !== undefined) {
      try {
        const urlsToKeep = new Set(processedLinks.map((l: any) => l.url));
        const knowledgeSnapshot = await db.collection("knowledge").where("userId", "==", userId).get();
        
        const batch = db.batch();
        let deleteCount = 0;
        
        knowledgeSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.source && (data.source.startsWith("http://") || data.source.startsWith("https://"))) {
            if (!urlsToKeep.has(data.source)) {
              batch.delete(doc.ref);
              deleteCount++;
            }
          }
        });

        if (deleteCount > 0) {
          await batch.commit();
          console.log(`[Auto-Cleanup] Deleted ${deleteCount} chunks for removed URLs`);
        }
      } catch (cleanupError) {
        console.error("[Auto-Cleanup] Failed to delete orphaned chunks:", cleanupError);
      }
    }

    // AUTO-TRAINING: Check if any new navigation links need training
    if (processedLinks.length > 0) {
      console.log(`[Auto-Training] Processing ${processedLinks.length} links for userId: ${userId}`);
      for (const link of processedLinks) {
        try {
          // 1. Check if we already have content for this URL
          const existing = await db.collection("knowledge")
            .where("userId", "==", userId)
            .where("source", "==", link.url)
            .limit(1)
            .get();

          if (existing.empty) {
            console.log(`[Auto-Training] Hardened Learning: ${link.url}`);
            
            // 2. Scrape content with Chrome-like User-Agent (to bypass WAF/Cloudflare)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
            
            try {
              const response = await fetch(link.url, { 
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                }
              });
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                console.warn(`[Auto-Training] HTTP Error ${response.status} for ${link.url}`);
                continue;
              }
              
              const html = await response.text();
              const $ = cheerio.load(html);
              
              // 3. Aggressive Content Cleaning
              $("script, style, noscript, nav, footer, iframe, header, aside, .ads, .sidebar, .menu").remove();
              let fullContent = $("body").text().replace(/\s+/g, " ").trim();

              if (fullContent.length > 10) {
                // 4. Industrial-Grade Chunking (Handle massive pages without crashing OpenAI)
                const chunkSize = 4000; // Character count per chunk
                const chunks = [];
                for (let i = 0; i < fullContent.length; i += chunkSize) {
                  chunks.push(fullContent.slice(i, i + chunkSize));
                }

                console.log(`[Auto-Training] Found ${chunks.length} chunks for ${link.url}`);

                for (const [index, chunk] of chunks.entries()) {
                  // 5. Generate Embedding per chunk
                  const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunk, 
                  });
                  const vector = embeddingResponse.data[0].embedding;

                  // 6. Store in knowledge base
                  await db.collection("knowledge").add({
                    userId,
                    source: link.url,
                    content: chunk,
                    vector,
                    createdAt: new Date().toISOString(),
                    chunkIndex: index,
                    totalChunks: chunks.length
                  });
                }
                console.log(`[Auto-Training] Fully Learned: ${link.url}`);
              }
            } catch (fetchError: any) {
              console.error(`[Auto-Training] Scrape Failure for ${link.url}:`, fetchError.message);
            }
          }
        } catch (e) {
          console.error(`[Auto-Training] Master Loop Error for ${link.url}:`, e);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Settings saved & training complete!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
