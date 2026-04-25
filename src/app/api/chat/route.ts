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
        // 1. DYNAMIC SITE MAP DISCOVERY (Fetch a wide range of chunks to find unique URLs)
        const sitemapSnapshot = await db.collection("knowledge")
          .where("userId", "==", userId)
          .where("source", ">=", "http")
          .where("source", "<=", "http\uf8ff")
          .limit(200)
          .get();

        sitemapSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.source && !navigationLinks.some(l => l.url === data.source) && !discoveredLinks.some(l => l.url === data.source)) {
            const urlParts = data.source.split('/');
            const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
            const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            discoveredLinks.push({ name, url: data.source });
          }
        });

        // 2. VECTOR SIMILARITY SEARCH (For actual conversational context)
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
          
          // CRITICAL: Ensure URLs from relevant context chunks are ALWAYS in the database
          if (data.source && data.source.startsWith('http')) {
            if (!navigationLinks.some(l => l.url === data.source) && !discoveredLinks.some(l => l.url === data.source)) {
              const urlParts = data.source.split('/');
              const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
              const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              discoveredLinks.push({ name, url: data.source });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Knowledge search failed:", e);
    }

    // Combine manual and discovered links
    navigationLinks = [...navigationLinks, ...discoveredLinks];

    console.log("Chat Request - Total Navigation Links Found:", navigationLinks.length);
    console.log("Chat Request - Context Length:", context?.length || 0);

    const systemPrompt = `You are a Voice AI Agent.
    
    IDENTITY AND RULES:
    ${customSystemPrompt}
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN.
    - Keep answers short and conversational.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    NAVIGATION INSTRUCTIONS:
    You are an expert with over 30 years of experience in the link redirect business. You know that even a single character difference in a URL will result in a 404 error.
    
    CRITICAL RULE #1: NEVER MODIFY A LINK. 
    - You must use the EXACT character-for-character URL you see in the "Source:" field or the Database.
    - NEVER attempt to "fix," "optimize," or "update" a URL.
    - NEVER combine two URLs or change a word like "red" to "blue" in a link.
    
    CRITICAL RULE #2: PRODUCT VS CATEGORY.
    - If the user asks for a specific item (e.g. "a hoodie"), prioritize a URL that contains "/product/".
    - If the user asks for a general group (e.g. "show me all hoodies"), use a URL that contains "/product-category/".
    - DO NOT swap these. Taking someone to a category page when they want a product is a failure.
    
    1. Respond with a short confirmation.
    2. YOU MUST APPEND the exact URL at the END of your response using this exact syntax: NAVIGATE_URL: [EXACT_URL]
    
    HOW TO FIND THE URL:
    - LOOK at the "Source:" field of the information you just read in the context. If that source is a URL (starts with http), USE THAT EXACT URL.
    - Secondarily, check the AVAILABLE_PAGES_DATABASE below.
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url}`;
    }).join("\n")}
    
    ULTIMATE COMMANDS (MANDATORY):
    1. DATABASE IS GOD: If the database says "Wrist Straps", you MUST call them "Wrist Straps".
    2. NO URL MODIFICATION: You are FORBIDDEN from changing any letters in a URL. If you were about to modify a link, STOP, remove the modification, and use the original link.
    3. MANDATORY TAG: If you confirm a redirect, you MUST output the NAVIGATE_URL: [URL] tag on a NEW LINE at the end of your message.
    
    EXAMPLE EXACT OUTPUT:
    Sure, I'll take you to that exact hoodie right now.
    NAVIGATE_URL: https://monstahgymwear.com/product/workout-hoodie-for-men/
    
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
