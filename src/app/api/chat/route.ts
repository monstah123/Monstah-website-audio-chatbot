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

    let context = "";
    try {
      // 2. Search Firestore for context, SCOPED TO THIS USER
      // Only query if we have a userId — enforces multi-tenant isolation
      if (userId) {
        const knowledgeRef = db.collection("knowledge").where("userId", "==", userId);
        const snapshot = await knowledgeRef.limit(15).get();
        snapshot.forEach((doc: any) => {
          const data = doc.data();
          context += `\nContent: ${data.content}\n---\n`;
        });
      }
    } catch (e) {
      console.warn("Knowledge search failed:", e);
    }

    // 3. Generate the AI response
    const aiClient = deepseek || openai;
    const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

    let customSystemPrompt = "You are a helpful and friendly customer service representative. Keep answers short and strictly based on the provided context.";
    let navigationLinks: { name: string; url: string }[] = [];
    
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

    // Build navigation instructions if the tenant configured any links
    const navInstructions = navigationLinks.length > 0
      ? `
    NAVIGATION INSTRUCTIONS — HIGHEST PRIORITY:
    You can send users to specific pages. When asked to navigate, go to a page, or view something:
    1. Respond with ONE short sentence confirming the action.
    2. You MUST append [NAVIGATE:url] at the very end — this is MANDATORY.
    3. COPY the URL CHARACTER-FOR-CHARACTER from the list below. Do NOT modify it in any way.
    
    AVAILABLE_PAGES_DATABASE:
    {
      ${navigationLinks.map((l) => `"${l.name}": "${l.url}"`).join(",\n      ")}
    }
    
    ZERO-TOLERANCE URL POLICY:
    1. You are FORBIDDEN from modifying any URL in the database above.
    2. Even if you think a URL is "wrong" or "missing a word" like "-ebook", DO NOT FIX IT.
    3. You must COPY the string exactly as it appears in the quotes.
    4. If you change a single character, the website will break and you will be penalized.
    
    MANDATORY FORMAT:
    "Confirmation sentence. [NAVIGATE:exact_url_from_database]"
    
    CORRECT: "[NAVIGATE:https://site.com/product/page/]"
    WRONG: "[NAVIGATE:https://site.com/product/page-ebook/]" (NEVER add words like -ebook)`
      : "";

    const systemPrompt = `You are a Voice AI Agent.
    
    CRITICAL: USER NAVIGATION (YOUR #1 PRIORITY)
    ${navInstructions}
    
    IDENTITY AND RULES:
    ${customSystemPrompt}
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN.
    - Keep answers short and conversational.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    FINAL RULES:
    1. If the user asks to "go to", "show me", "take me to", or "open" a page, you MUST check the AVAILABLE_PAGES_DATABASE above.
    2. DO NOT USE ANY URLS FOUND IN THE "CONTEXT FOR QUESTIONS" FOR NAVIGATION. THOSE ARE OFTEN STALE OR WRONG.
    3. ONLY USE THE URLS IN THE AVAILABLE_PAGES_DATABASE.
    4. If a match is found, use the [NAVIGATE:url] tag with the EXACT string from the database.
    5. If no match is found in the database, DO NOT navigate. Just answer the question normally.
    6. Keep responses extremely short (1-2 sentences).`;

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
