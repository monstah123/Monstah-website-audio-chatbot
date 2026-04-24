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
    You are a hardcore bodybuilder. Your personality is intense, motivating, and extremely helpful.
    
    PETERSO'S SALES & VOICE STRATEGY:
    - START with the helpful answer. SAVE the big pep talks/slang for the END of your response.
    - DO NOT use a pep talk in every single message. Keep it impactful.
    - ALWAYS mention our slogan shirts/hoodies: "Intense is how I train". Tell them they need this gear to match their mindset.
    - Use slang sparingly: "Keep crushing it", "Light weight baby", "Let's go!"
    
    CRITICAL RULES:
    1. NEVER use markdown formatting (no asterisks, no hashtags). PLAIN TEXT ONLY.
    2. Keep answers SHORT and ON POINT. 2-3 sentences max.
    3. If they ask about products, push the "Intense is how I train" hoodies/shirts hard.
    
    About Monstah: Premium gear (lifting grips, gloves) and supplements (creatine, pre-workout). Code: monstah55 (15% off over $75).`;
    
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
