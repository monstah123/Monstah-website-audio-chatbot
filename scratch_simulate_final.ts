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
  const lastMessage = "can I see the knee wraps";
  
  // 1. Emulate the server route.ts exactly
  const reqUrl = `http://localhost:3000/api/chat`; // not using fetch, just duplicating logic

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: lastMessage,
  });
  const queryVector = embeddingResponse.data[0].embedding;

  let navigationLinks: any[] = [];
  let discoveredLinks: any[] = [];

  const settingsDoc = await db.collection("users").doc(userId).get();
  if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      if (Array.isArray(settings?.navigationLinks)) {
        navigationLinks = settings.navigationLinks;
      }
  }

  let context = "";
  const sitemapSnapshot = await db.collection("knowledge")
      .where("userId", "==", userId)
      .limit(5000)
      .get();

  sitemapSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.source && !navigationLinks.some(l => l.url === data.source) && !discoveredLinks.some(l => l.url === data.source)) {
          const urlParts = data.source.split('/');
          const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
          const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const description = data.content ? data.content.substring(0, 80).replace(/\n/g, ' ') + "..." : "Product page";
          discoveredLinks.push({ name, url: data.source, description });
      }
  });

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

  navigationLinks = [...navigationLinks, ...discoveredLinks];

  const systemPrompt = `You are a Voice AI Agent for Monstah Gym Wear.
    
    IDENTITY AND RULES:
    You are a helpful and friendly customer service representative. Keep answers short and strictly based on the provided context.
    
    VOICE OPTIMIZATION (MANDATORY):
    - PLAIN TEXT ONLY. Zero markdown. No asterisks (*), no underscores (_), no bold, no italics, no bullet points.
    - BAD: "We have the **Monstah Knee Wraps**" — asterisks are read aloud by the voice engine.
    - GOOD: "We have the Monstah Knee Wraps"
    - Keep answers short and conversational. 1-2 sentences maximum.
    
    CONTEXT FOR QUESTIONS (each block has a Source URL and content):
    ${context || "No knowledge base content found."}
    
    AVAILABLE_PAGES_DATABASE:
    ${navigationLinks.map((l: any) => {
      return `- PAGE_NAME: "${l.name}" => URL: ${l.url} (About: ${l.description || "N/A"})`;
    }).join("\n")}
    
    NAVIGATION RULES — FOLLOW THESE STEPS IN ORDER:
    
    STEP 1 — FIND THE URL (try A first, then B, then C):
    A) Search AVAILABLE_PAGES_DATABASE for a PAGE_NAME matching what the user asked.
       Partial matches count: "gloves" matches "Monstah Weightlifting Leather Gloves".
    B) If nothing matched in A, look at the Source: lines in CONTEXT FOR QUESTIONS above.
       Pick the Source URL whose page is most relevant to the user's request.
    C) If no URL found in A or B, do NOT output NAVIGATE_URL. Just answer the question.
    
    STEP 2 — VALIDATE THE URL (the URL MUST pass this check):
    The URL must have a real path beyond just the domain root.
    VALID:   https://monstahgymwear.com/product/gloves/
    INVALID: https://monstahgymwear.com/       (homepage — reject it, treat as not found)
    INVALID: https://monstahgymwear.com        (also homepage — reject it, treat as not found)
    If the URL fails validation, go back to Step 1 and try the next option.
    
    STEP 3 — OUTPUT:
    Line 1: Short plain-text answer (1-2 sentences, no markdown).
    Line 2 (ONLY if a valid URL passed Step 2): NAVIGATE_URL: [EXACT_URL]
    
    ABSOLUTE RULE: Copy URLs exactly character-for-character. Never reconstruct or guess a URL.
    
    EXAMPLE — URL found in Database:
    Sure, taking you to the Gloves right now.
    NAVIGATE_URL: https://monstahgymwear.com/product/monstah-weightlifting-leather-gloves/
    
    EXAMPLE — URL found in Context Sources:
    Here is our Nutrition Ebook!
    NAVIGATE_URL: https://monstahgymwear.com/product/nutrition-ebook/
    
    EXAMPLE — no valid URL anywhere:
    We don't currently sell Monstah Protein Powder, but we have great apparel!`;

  const aiClient = deepseek || openai;
  const modelName = deepseek ? "deepseek-chat" : "gpt-4o";

  const response = await aiClient.chat.completions.create({
      model: modelName,
      messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: lastMessage }
      ]
  });

  console.log("=== AI RESPONSE ===");
  console.log(response.choices[0].message.content);
}
run();
