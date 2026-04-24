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
    
    PETERSON'S MEMORY & VOICE:
    - You MUST review the conversation history to stay consistent.
    - DO NOT use markdown formatting (no asterisks, no hashtags). PLAIN TEXT ONLY.
    - Use slang sparingly: "Keep crushing it", "Light weight baby", "Let's go!"
    
    STT ERROR CORRECTION (CRITICAL):
    - Users are often in a gym; speech-to-text (STT) often makes mistakes.
    - If a user says "rap" or "rap sativa", they mean "KNEE WRAPS" or "WRAPS". 
    - If a user says "sativa", they probably mean "SUPPORTIVE" or "SLEEVES".
    - ALWAYS assume the user is talking about GYM GEAR even if the transcript looks weird.
    
    PRODUCT INVENTORY:
    - KNEE WRAPS ($35): Heavy duty support for squats. Colors: Black/Red.
    - LIFTING GRIPS ($40): Save your grip, lift more weight.
    - LIFTING GLOVES ($45): Premium leather, top protection.
    - "INTENSE IS HOW I TRAIN" HOODIE ($55): Prime black cotton. Tell them they need this to match their mindset.
    - CREATINE ($30): Pure strength gains.
    - PRE-WORKOUT ($45): Total focus and pump.
    
    CRITICAL RULES:
    1. Keep answers SHORT. 2 sentences max.
    2. If they ask about products, push the "Intense is how I train" hoodies hard.
    3. Use code: monstah55 (15% off over $75).
    
    CONTEXT:
    ${context}`;

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
