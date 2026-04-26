import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepseek = process.env.DEEPSEEK_API_KEY 
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // 1. Convert the user's question into a vector (Always use OpenAI for embeddings)
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: lastMessage,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    const aiClient = deepseek || openai;
    const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

    let customSystemPrompt = "You are a helpful and friendly customer service representative. Keep answers short and strictly based on the provided context.";
    let navigationLinks: { name: string; url: string }[] = [];
    let discoveredLinks: { name: string; url: string }[] = [];
    
    // Fetch user settings to get their custom prompt and navigation links
    if (userId) {
      try {
        const settingsDoc = await db.collection("users").doc(userId).get();
        if (settingsDoc.exists) {
          const settings = settingsDoc.data();
          if (settings?.systemPrompt) {
            customSystemPrompt = settings.systemPrompt;
          }
          // Support both array format and legacy {name:url} object format
          if (Array.isArray(settings?.navigationLinks)) {
            navigationLinks = settings.navigationLinks;
          } else if (settings?.navigationLinks && typeof settings.navigationLinks === 'object') {
            // Migrate old format on-the-fly
            navigationLinks = Object.entries(settings.navigationLinks).map(
              ([name, url]) => ({ name, url: url as string })
            );
          }
        }
      } catch (e) {
        console.warn("Could not fetch user settings", e);
      }
    }

    let context = "";
    try {
      if (userId) {
        // 1. DYNAMIC SITE MAP DISCOVERY (Fetch a massive range to find EVERY link)
        const sitemapSnapshot = await db.collection("knowledge")
          .where("userId", "==", userId)
          .limit(5000) // Fetch enough to find all unique URLs
          .get();

        sitemapSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.source && !navigationLinks.some(l => l.url === data.source) && !discoveredLinks.some(l => (l as any).url === data.source)) {
            const urlParts = data.source.split('/');
            const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
            const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const description = data.content ? data.content.substring(0, 80).replace(/\n/g, ' ') + "..." : "Product page";
            (discoveredLinks as any).push({ name, url: data.source, description });
          }
        });

        // 2. VECTOR SIMILARITY SEARCH
        const knowledgeSnapshot = await db.collection("knowledge")
          .where("userId", "==", userId)
          .limit(200)
          .get();

        const docs = knowledgeSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any));

        const sortedDocs = docs.map(doc => {
          if (!doc.vector || !queryVector) return { ...doc, similarity: 0 };
          const dotProduct = doc.vector.reduce((sum: number, val: number, i: number) => sum + val * queryVector[i], 0);
          const mag1 = Math.sqrt(doc.vector.reduce((sum: number, val: number) => sum + val * val, 0));
          const mag2 = Math.sqrt(queryVector.reduce((sum: number, val: number) => sum + val * val, 0));
          const similarity = dotProduct / (mag1 * mag2);
          return { ...doc, similarity };
        }).sort((a, b) => b.similarity - a.similarity).slice(0, 15);

        sortedDocs.forEach((data) => {
          context += `\nSource: ${data.source}\nContent: ${data.content}\n---\n`;
          
          if (data.source && data.source.startsWith('http')) {
            if (!navigationLinks.some(l => l.url === data.source) && !discoveredLinks.some(l => (l as any).url === data.source)) {
              const urlParts = data.source.split('/');
              const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
              const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const description = data.content ? data.content.substring(0, 80).replace(/\n/g, ' ') + "..." : "Product page";
              (discoveredLinks as any).push({ name, url: data.source, description });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Knowledge search failed:", e);
    }

    // Combine manual and discovered links
    navigationLinks = [...navigationLinks, ...discoveredLinks];

    const systemPrompt = `You are a Voice AI Agent for Monstah Gym Wear.
    
    IDENTITY AND RULES:
    ${customSystemPrompt}
    
    UNIVERSAL PRODUCT MATCHING (MANDATORY):
    - You must dynamically match what the user asks for to the PAGE_NAME in the database.
    - If the user asks for a product (e.g., "knee wraps", "ebook", "dog food"), and you see a PAGE_NAME that contains those words (e.g., "Monstah Heavy Duty Knee Wraps", "Nutrition Ebook", "Premium Dog Food"), YOU MUST USE IT.
    - Partial and fuzzy matches are correct. Do NOT fallback to the homepage if a partial match exists.
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN.
    - Keep answers short and conversational.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l: any) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url} (About: ${l.description || "N/A"})`;
    }).join("\n")}
    
    NAVIGATION INSTRUCTIONS:
    You are an expert with over 30 years of experience in the link redirect business.
    
    CRITICAL RULE #1: NEVER MODIFY A LINK. 
    - Use the EXACT character-for-character URL from the Database or Sources.
    
    CRITICAL RULE #2: SOURCE URL PRIORITY (MANDATORY).
    - If you see a URL next to "Source:" in the CONTEXT below, and that content is about the product the user is asking for, YOU MUST USE THAT EXACT URL.
    - These "Source" URLs are your most accurate links. Never ignore them.
    
    CRITICAL RULE #3: EXACT MATCH PRIORITY (MANDATORY).
    - If the user's request matches a PAGE_NAME in the list below, you MUST use that URL.
    - If the user asks for "Supplements Generator" and you see "Supplements Generator" in the list, you MUST use it.
    
    CRITICAL RULE #4: NO HOMEPAGE FALLBACK.
    - You are FORBIDDEN from using the homepage URL (https://monstahgymwear.com/) for specific page or product requests.
    - Using the homepage as a fallback for "gloves", "hoodies", or "generators" is a critical failure.
    
    1. Respond with a short confirmation.
    2. APPEND the exact URL at the END using: NAVIGATE_URL: [URL]
    
    ULTIMATE COMMANDS:
    1. NO Hallucinations: If you can't find a matching link in the Sources or Database, simply say you can't find it. Never guess the homepage.
    2. MANDATORY TAG: Output the NAVIGATE_URL: [URL] tag on a NEW LINE at the end.
    
    EXAMPLE EXACT OUTPUT:
    Sure, taking you to the Supplements Generator right now.
    NAVIGATE_URL: https://monstahgymwear.com/nutritional-supplements-generator/
    
    FINAL RULES:
    1. Speak naturally but keep it to 1-2 short sentences.
    2. The NAVIGATE_URL: tag DOES NOT count as a sentence.
    3. You have 30 years of experience. You know that original links ARE the only ones that work. NEVER modify them.`;

    // 3. Limit conversation history for speed (Last 10 messages for better memory)
    const limitedMessages = messages.slice(-10);

    const response = await aiClient.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...limitedMessages,
      ],
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = (chunk as any).choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (err) {
          console.error("Stream processing error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
