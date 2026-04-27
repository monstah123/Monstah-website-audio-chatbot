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
  const lastMessage = "not wrist straps bro knee wraps";
  
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: lastMessage,
  });
  const queryVector = embeddingResponse.data[0].embedding;

  let context = "";
  const knowledgeSnapshot = await db.collection("knowledge")
    .where("userId", "==", userId)
    .limit(200)
    .get();

  const docs = knowledgeSnapshot.docs.map(doc => ({
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

  console.log("CONTEXT FOUND FOR 'not wrist straps bro knee wraps':");
  console.log(context);
}
run();
