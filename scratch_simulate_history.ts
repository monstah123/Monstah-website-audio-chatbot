import { db } from "./src/lib/firebase-admin";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepseek = process.env.DEEPSEEK_API_KEY 
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "knee wraps",
  });
  const queryVector = embeddingResponse.data[0].embedding;

  let context = "";
  const sitemapSnapshot = await db.collection("knowledge")
      .where("userId", "==", userId)
      .limit(5000)
      .get();

  const docs = sitemapSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
  } as any));

  const sortedDocs = docs.map(doc => {
      if (!doc.vector || !queryVector) return { ...doc, similarity: 0 };
      const dotProduct = doc.vector.reduce((sum: number, val: number, i: number) => sum + val * queryVector[i], 0);
      const mag1 = Math.sqrt(doc.vector.reduce((sum: number, val: number) => sum + val * val, 0));
      const mag2 = Math.sqrt(queryVector.reduce((sum: number, val: number) => sum + val * val, 0));
      const similarity = dotProduct / (mag1 * mag2);
      return { ...doc, similarity };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 15);

  sortedDocs.forEach((data) => {
      context += `\nSource: ${data.source}\nContent: ${data.content}\n---\n`;
  });

  const systemPrompt = `You are a Voice AI Agent for Monstah Gym Wear.
    
    CONTEXT FOR QUESTIONS (each block has a Source URL and content):
    ${context || "No knowledge base content found."}
    
    AVAILABLE_PAGES_DATABASE:
    - PAGE_NAME: "Monstah Lifting Wrist Wraps" => URL: https://monstahgymwear.com/product/monstah-lifting-wrist-wraps/ (About: N/A)
    - PAGE_NAME: "Monstah Lifting Wrist Straps" => URL: https://monstahgymwear.com/product/monstah-lifting-wrist-straps/ (About: N/A)
    - PAGE_NAME: "Monstah Knee Straps" => URL: https://monstahgymwear.com/product/monstah-knee-straps/ (About: N/A)
    - PAGE_NAME: "Monstah Knee Wraps" => URL: https://monstahgymwear.com/product/monstah-heavy-duty-knee-wraps/ (About: N/A)
    
    STEP 1 — FIND THE URL (try A first, then B, then C):
    A) Search AVAILABLE_PAGES_DATABASE for a PAGE_NAME matching what the user asked.
    B) If nothing matched in A, look at the Source: lines in CONTEXT FOR QUESTIONS above.
    C) If no URL found in A or B, do NOT output NAVIGATE_URL. Just answer the question.
    
    STEP 3 — OUTPUT:
    Line 1: Short plain-text answer (1-2 sentences, no markdown).
    Line 2 (ONLY if a valid URL passed Step 2): NAVIGATE_URL: [EXACT_URL]`;

  const aiClient = deepseek || openai;
  const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

  const response = await aiClient.chat.completions.create({
      model: modelName,
      messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "not wrist straps bro knee wraps" },
          { role: "assistant", content: "I am sorry, it looks like we don't currently list knee wraps on the site, but we have the Monstah Lifting Wrist Wraps and heavy-duty lifting gloves for your other gear." },
          { role: "user", content: "knee wraps" }
      ]
  });

  console.log("=== AI RESPONSE WITH HISTORY ===");
  console.log(response.choices[0].message.content);
}
run();
