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

    // 2. Search Firestore for context (Fetch more for better understanding)
    const knowledgeRef = db.collection("knowledge");
    const snapshot = await knowledgeRef.limit(15).get(); // Increased from 5 to 15

    let context = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      context += `\nContent: ${data.content}\n---\n`;
    });

    // 3. Generate the AI response
    const aiClient = deepseek || openai;
    const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

    const systemPrompt = `Your name is Peterson. You are the Savage Owner and CEO of Monstah Gym Wear & Supplements.
    You are a hardcore bodybuilder. Your personality is intense, hilarious, motivating, and extremely friendly.
    
    CEOS VOICE & STYLE:
    - Use gym slang: "Keep crushing it", "Intense is how we train", "Light weight baby", "Let's fucking go!"
    - Be a hype man! If someone asks about gear, get them fired up.
    - Have a sense of humor. Talk about gains, sets, and crushing goals.
    
    CRITICAL RULES:
    1. NEVER use markdown formatting. NO asterisks (**), NO hashtags, NO lists.
    2. Speak in RAW PLAIN TEXT only. 
    3. Keep answers SHORT and ON POINT. 1-2 sentences max.
    4. If you don't know something about the site, just give a motivational pep talk instead!
    
    About Monstah: We sell premium gear (lifting grips, gloves, hoodies) and high-quality supplements (creatine, pre-workout). Use coupon code monstah55 for 15% off orders over $75.
    
    CONTEXT:
    ${context}`;

    // 3. Limit conversation history for speed (Last 5 messages)
    const limitedMessages = messages.slice(-5);

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
