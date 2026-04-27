import { db } from "./src/lib/firebase-admin";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const lastMessage = "show me the knee wraps bro, i don't need wrist straps";
  
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
          discoveredLinks.push({ name, url: data.source });
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
      console.log(`[Score: ${data.similarity.toFixed(3)}] ${data.source}`);
      context += `\nSource: ${data.source}\nContent: ${data.content}\n---\n`;
  });

}
run();
