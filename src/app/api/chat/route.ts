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
    let navigationLinks: Record<string, string> = {};
    
    // Fetch user settings to get their custom prompt and navigation links
    if (userId) {
      try {
        const settingsDoc = await db.collection("users").doc(userId).get();
        if (settingsDoc.exists) {
          const settings = settingsDoc.data();
          if (settings?.systemPrompt) {
            customSystemPrompt = settings.systemPrompt;
          }
          if (settings?.navigationLinks) {
            navigationLinks = settings.navigationLinks;
          }
        }
      } catch (e) {
        console.warn("Could not fetch user settings", e);
      }
    }

    // Build navigation instructions if the tenant configured any links
    const navInstructions = Object.keys(navigationLinks).length > 0
      ? `
    NAVIGATION INSTRUCTIONS — HIGHEST PRIORITY:
    You have the ability to redirect the user to pages. When a user asks to go somewhere, 
    view a product, or navigate anywhere:
    1. Give a SHORT one-sentence confirmation (e.g. "Taking you there now!").
    2. You MUST append [NAVIGATE:url] at the very end — this is non-negotiable.
    Available pages:
    ${Object.entries(navigationLinks).map(([name, url]) => `- ${name}: ${url}`).join("\n")}
    CRITICAL: Always end your response with [NAVIGATE:url] when navigating. Never omit it.
    Example output: "Taking you to the hoodie page now! [NAVIGATE:https://example.com/hoodies]"
    Only use URLs from the list above. Do not make up URLs.`
      : "";

    const systemPrompt = `You are a Voice AI Agent.
    
    IDENTITY AND RULES:
    ${customSystemPrompt}
    ${navInstructions}
    
    VOICE OPTIMIZATION:
    - PLAIN TEXT ONLY. NO MARKDOWN (no asterisks, no hashtags).
    - Keep answers short and conversational.
    - If you do not know the answer, say so politely.
    
    CRITICAL INSTRUCTION: Answer based ONLY on the provided context.
    
    PROVIDED CONTEXT:
    ${context || "No knowledge base content found."}
    
    CRITICAL RULES:
    1. Keep answers SHORT (1-2 sentences max) UNLESS you are navigating — navigation responses must include the [NAVIGATE:url] tag.
    2. Be extremely helpful and direct.
    3. NEVER hallucinate product data, prices, or URLs not found in the context.`;

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
