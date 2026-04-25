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
      // 2. Search Firestore for context, SCOPED TO THIS USER
      if (userId) {
        const knowledgeRef = db.collection("knowledge").where("userId", "==", userId);
        const snapshot = await knowledgeRef.limit(15).get();
        snapshot.forEach((doc: any) => {
          const data = doc.data();
          context += `\nSource: ${data.source}\nContent: ${data.content}\n---\n`;
          
          // Auto-discover links from training data sources
          if (data.source && data.source.startsWith('http')) {
            const alreadyExists = navigationLinks.some((l: any) => l.url === data.source);
            const alreadyDiscovered = discoveredLinks.some((l: any) => l.url === data.source);
            
            if (!alreadyExists && !alreadyDiscovered) {
              const urlParts = data.source.split('/');
              const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Trained Page";
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

    console.log("Chat Request - Navigation Links:", navigationLinks);
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
    You have access to a list of specific pages on the user's website.
    1. Respond with a short confirmation.
    2. YOU MUST APPEND the exact URL at the END of your response using this exact syntax: NAVIGATE_URL: [EXACT_URL_FROM_DATABASE]
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url}`;
    }).join("\n")}
    
    ULTIMATE COMMANDS (MANDATORY):
    1. DATABASE IS GOD: If the database says "Wrist Straps", you MUST call them "Wrist Straps". If the context or your brain says "Wraps", you MUST IGNORE IT and say "Straps".
    2. NO Hallucinations: If a product name in the database contains "Straps", you are FORBIDDEN from using the word "Wraps".
    3. MANDATORY TAG: If you confirm a redirect to a page in the database, you MUST output the NAVIGATE_URL: [URL] tag on a NEW LINE at the end of your message.
    
    EXAMPLE EXACT OUTPUT:
    Sure, I'll take you to that page right now.
    NAVIGATE_URL: https://example.com/target-page
    
    FINAL RULES:
    1. Speak naturally but keep it to 1-2 short sentences.
    2. The NAVIGATE_URL: tag DOES NOT count as a sentence. You MUST include it on a new line if a redirect is happening.
    3. You MUST use the EXACT URL from the AVAILABLE_PAGES_DATABASE!`;

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
