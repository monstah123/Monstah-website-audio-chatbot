import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const settingsRef = db.collection("users").doc(userId);
  const doc = await settingsRef.get();
  
  let data = doc.data() || {};
  let navigationLinks: any[] = [];
  
  const knowledgeSnapshot = await db.collection("knowledge")
    .where("userId", "==", userId)
    .limit(5000)
    .get();

  knowledgeSnapshot.forEach((doc: any) => {
    const kData = doc.data();
    if (kData.source) {
      const alreadyExists = navigationLinks.some((l: any) => l.url === kData.source);
      if (!alreadyExists) {
        const urlParts = kData.source.split('/');
        const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Page";
        const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        navigationLinks.push({ name, url: kData.source });
      }
    }
  });

  console.log("=== WHAT THE UI SEES ===");
  console.log(JSON.stringify(navigationLinks, null, 2));
}
run();
