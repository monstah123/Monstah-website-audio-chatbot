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
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // 1. Convert the user's question into a vector (Always use OpenAI for embeddings)
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: lastMessage,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    // 2. Search Firestore for context
    const knowledgeRef = db.collection("knowledge");
    const snapshot = await knowledgeRef.limit(5).get();

    let context = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      context += `\nSource: ${data.title || data.fileName}\nContent: ${data.content}\n---\n`;
    });

    // 3. Generate the AI response
    // Use DeepSeek if key is available, otherwise fallback to OpenAI GPT-4o
    const aiClient = deepseek || openai;
    const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

    console.log(`🧠 Using Model: ${modelName}`);

    const systemPrompt = `You are the Monstah Gym Wear & Supplements Assistant. 
    Your goal is to be helpful, concise, and conversational.
    
    IMPORTANT RULES:
    1. NEVER use markdown formatting like asterisks (**), hashtags, or lists.
    2. Speak in PLAIN TEXT only. No symbols or special formatting.
    3. Be CONCISE. Keep responses to 1-2 short sentences. 
    4. Don't dump information. Answer the specific question and then wait for the user.
    5. Be "Monstah" - energetic, friendly, and professional.
    
    About Monstah: We sell premium gym gear (lifting grips, gloves, hoodies) and high-quality supplements (creatine, pre-workout). Use coupon code monstah55 for 15% off orders over $75.
    
    CONTEXT:
    ${context}`;

    const response = await aiClient.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = (chunk as any).choices[0]?.delta?.content || "";
          controller.enqueue(new TextEncoder().encode(content));
        }
        controller.close();
      },
    });

    return new NextResponse(stream);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
