import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const sitemapSnapshot = await db.collection("knowledge")
      .where("userId", "==", userId)
      .get();

  console.log(`Total knowledge chunks: ${sitemapSnapshot.docs.length}`);
  
  const sources = new Set();
  sitemapSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.source) sources.add(data.source);
  });
  
  console.log("\nSources in Database:");
  sources.forEach(source => console.log(source));

  const settingsDoc = await db.collection("users").doc(userId).get();
  const settings = settingsDoc.data();
  console.log("\nNavigation Links in Users DB:");
  console.log(JSON.stringify(settings?.navigationLinks, null, 2));
}
run();
