import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  
  const sitemapSnapshot = await db.collection("knowledge")
      .where("userId", "==", userId)
      .where("source", "==", "https://monstahgymwear.com/product/monstah-heavy-duty-knee-wraps/")
      .get();

  sitemapSnapshot.forEach(doc => {
      console.log(`\n--- CHUNK ---\n${doc.data().content}`);
  });
}
run();
