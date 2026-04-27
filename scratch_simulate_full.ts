import { db } from "./src/lib/firebase-admin";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const lastMessage = "can I see the knee wraps";
  
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: lastMessage,
  });
  const queryVector = embeddingResponse.data[0].embedding;

  // FETCH ALL CHUNKS (like the new code)
  const knowledgeSnapshot = await db.collection("knowledge")
    .where("userId", "==", userId)
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
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 5);

  console.log("TOP 5 SOURCES FOUND:");
  sortedDocs.forEach((data) => {
    console.log(`[Score: ${data.similarity.toFixed(3)}] ${data.source}`);
  });
}
run();
