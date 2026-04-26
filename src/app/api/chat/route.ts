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
    
    VOICE OPTIMIZATION (MANDATORY — VIOLATIONS BREAK THE PRODUCT):
    - PLAIN TEXT ONLY. Absolutely zero markdown. No asterisks (*), no underscores (_), no bold, no italics, no bullet points, no headers.
    - BAD: "We have the **Monstah Knee Wraps**" — the asterisks will be read aloud by the voice engine.
    - GOOD: "We have the Monstah Knee Wraps"
    - Keep answers short and conversational. 1-2 sentences maximum.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l: any) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url} (About: ${l.description || "N/A"})`;
    }).join("\n")}
    
    NAVIGATION RULES (READ EVERY WORD):
    
    RULE 1 — NEVER MODIFY A URL.
    Use the EXACT character-for-character URL from the Database or Sources. Never guess, never reconstruct.
    
    RULE 2 — PRODUCT MATCHING.
    Match what the user says to PAGE_NAME entries above. Partial matches are fine ("knee wraps" matches "Monstah Heavy Duty Knee Wraps").
    
    RULE 3 — URL MUST HAVE A REAL PATH. THIS IS THE MOST IMPORTANT RULE.
    A valid redirect URL MUST contain a path with at least one segment after the domain.
    VALID:   https://monstahgymwear.com/product/knee-wraps/
    INVALID: https://monstahgymwear.com/       <— this is the homepage. NEVER use this.
    INVALID: https://monstahgymwear.com        <— this is also the homepage. NEVER use this.
    If you only have the homepage URL and no specific product URL, DO NOT output NAVIGATE_URL at all.
    
    RULE 4 — NO HOMEPAGE FALLBACK, EVER.
    If you cannot find a specific product URL in the Sources or Database: answer the question normally. Do NOT output NAVIGATE_URL.
    Sending a user to the homepage when they asked for a product is a critical system failure.
    
    OUTPUT FORMAT:
    Line 1: Short answer (plain text, no markdown, 1-2 sentences).
    Line 2 (only if a valid specific-page URL was found): NAVIGATE_URL: [EXACT_URL]
    
    EXAMPLE — specific URL found:
    Sure, taking you to the Knee Wraps right now.
    NAVIGATE_URL: https://monstahgymwear.com/product/monstah-heavy-duty-knee-wraps/
    
    EXAMPLE — no specific URL found:
    We have the Monstah Heavy Duty Knee Wraps, great for heavy squat sessions!
    
    Remember: if the URL path is just / you MUST NOT output NAVIGATE_URL.`;


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
