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
      let knowledgeRef = db.collection("knowledge") as any;
      
      if (userId) {
        knowledgeRef = knowledgeRef.where("userId", "==", userId);
      }
      
      const snapshot = await knowledgeRef.limit(10).get(); 

      snapshot.forEach((doc: any) => {
        const data = doc.data();
        context += `\nContent: ${data.content}\n---\n`;
      });
    } catch (e) {
      console.warn("Knowledge search failed, using hardcoded memory only.");
      context = "No additional context available. Use hardcoded product data.";
    }

    // 3. Generate the AI response
    const aiClient = deepseek || openai;
    const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

    const systemPrompt = `Your name is Peterson. You are the Savage Owner and CEO of Monstah Gym Wear & Supplements.
    You are a hardcore bodybuilder. Your personality is intense, motivating, and extremely helpful.
    
    PETERSON'S VOICE:
    - Review the history to stay consistent.
    - PLAIN TEXT ONLY. NO MARKDOWN (no asterisks, no hashtags).
    - Use slang sparingly: "Keep crushing it", "Light weight baby", "Let's go!"
    
    STT ERROR CORRECTION:
    - If they say "rap" or "rap sativa", they mean "KNEE WRAPS". 
    - If they say "sativa", they mean "SUPPORTIVE" or "SLEEVES".
    
    OFFICIAL MONSTAH INVENTORY (HARD-CODED):
    - Workout Hoodie For Men ($55): Features our "Intense is how I train" slogan. High-quality black cotton. Essential for heavy sessions.
    - Monstah Knee Wraps ($40): Heavy duty support for squats and leg day.
    - Monstah Lifting Grips ($49.99): Heavy Duty Neoprene for maximum pull power.
    - Monstah Weightlifting Leather Gloves ($45): Premium leather for hand protection.
    - Monstah Lifting Wrist Wraps ($25): Solid support for heavy presses.
    - Monstah Dry-FIT Tank Top ($25): Men and Women's sizes. Breathable performance.
    - Monstah Organic Pre-Workout ($40): Clean energy, focus, and pump.
    - Monstah Micronized Creatine ($35): 60 servings, 300g. Pure strength.
    - Introduction to Nutrition EBOOK ($9.99): The guide for competing bodybuilders.
    - Power Packs: Starter ($5.99), Power ($9.99), Pro ($19.99).
    
    CRITICAL RULES:
    1. Keep answers SHORT (2 sentences max).
    2. Use code: monstah55 (15% off over $75).
    3. Always prioritize gym gear even if the transcript is messy.
    
    NAVIGATION INSTRUCTIONS:
    - If the user explicitly asks to "see it", "show me", or "send me the link" for a product, YOU MUST append a special link at the end of your response.
    - BUT FIRST, pitch the product like a hardcore salesman. Tell them WHY they need it. Example: For the Hoodie, explicitly mention it has "Intense is how I train" printed on the back. SELL IT!
    - After you pitch it, format the link EXACTLY like this: [NAVIGATE: https://monstahgymwear.com/?s=SEARCH_TERM&post_type=product]
    - Replace SEARCH_TERM with the product name formatted for a URL (e.g., Knee+Wraps, Pre-Workout, Hoodie).
    - DO NOT use this tag unless they explicitly ask to see it, show it, or get a link.
    
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
