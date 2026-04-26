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
          .limit(1000) // Fetch enough to find all unique URLs
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
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN.
    - Keep answers short and conversational.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    SMART LINK MATCHING (MANDATORY):
    - You have 30 years of experience in SEO and redirects.
    - NEVER guess or hallucinate a URL.
    - To find the correct link, you MUST scan the "About:" field and "Context" for semantic matches.
    - EXAMPLE: If a user asks for an "E-book" and you see a product named "Nutrition Guide" with a description mentioning "digital download", that is the link you use.
    - EXAMPLE: If a user asks for "wraps" and you see "Knee Wraps" and "Wrist Straps", ask for clarification or provide both.
    
    CRITICAL RULE #1: USE THE SOURCE.
    - Look at the "Source:" field in the CONTEXT FOR QUESTIONS below. This is the most accurate link for the information provided.
    
    CRITICAL RULE #2: NO HOMEPAGE FALLBACK.
    - If the user asks for a product, you are FORBIDDEN from using the homepage. If you can't find a matching product link in the database, tell them you don't have that specific link right now.
    
    1. Respond with a short confirmation.
    2. APPEND the exact URL at the END using: NAVIGATE_URL: [URL]
    
    FINAL RULES:
    1. Speak naturally but keep it to 1-2 short sentences.
    2. The NAVIGATE_URL: tag DOES NOT count as a sentence.
    3. You MUST use a link from the AVAILABLE_PAGES_DATABASE or CONTEXT SOURCES.
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l: any) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url} (About: ${l.description || "N/A"})`;
    }).join("\n")}
    
    ULTIMATE COMMAND: Output the NAVIGATE_URL: [URL] tag on a NEW LINE at the end.`;

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
