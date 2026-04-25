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

    const systemPrompt = `You are a Voice AI Agent.
    
    IDENTITY AND RULES:
    ${customSystemPrompt}
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN.
    - Keep answers short and conversational.
    
    CONTEXT FOR QUESTIONS:
    ${context || "No knowledge base content found."}
    
    NAVIGATION INSTRUCTIONS:
    You have access to a list of specific URLs on the user's website. If the user asks for a page, or if you mention a product that exists in the list below:
    1. Respond with a short confirmation or helpful sentence.
    2. Append the EXACT URL in this tag: [NAVIGATE:url]
    
    AVAILABLE_PAGES_DATABASE (USE THESE EXACT URLS):
    ${navigationLinks.map(l => `- NAME: "${l.name}" => URL: "${l.url}"`).join("\n")}
    
    CRITICAL RULES:
    1. PROACTIVE LINKING: If you are talking about the "Introduction to Nutrition" guide, you MUST append the [NAVIGATE:] tag for it automatically.
    2. KEYWORD MATCHING: "e-book", "guide", and "nutrition" all match the "Introduction to Nutrition" link.
    3. EXACT COPY: Copy the URL exactly. Never change it.
    
    FINAL RULES:
    1. Respond in 1-2 short sentences maximum.
    2. Be helpful and enthusiastic.
    3. If a match is found in the database, you MUST navigate. No excuses.`;

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
