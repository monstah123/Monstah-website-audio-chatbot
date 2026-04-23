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

    const response = await aiClient.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `You are a premium AI assistant for a professional WordPress site. 
          Use the following context to answer the user's question. 
          If the answer is not in the context, tell them you don't know but offer to help with other product questions.
          Keep your answer concise and professional.
          
          CONTEXT:
          ${context}`,
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
