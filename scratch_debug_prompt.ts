import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  let navigationLinks: any[] = [];
  let discoveredLinks: any[] = [];

  const settingsDoc = await db.collection("users").doc(userId).get();
  if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      if (Array.isArray(settings?.navigationLinks)) {
        navigationLinks = settings.navigationLinks;
      }
  }

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
          discoveredLinks.push({ name, url: data.source, description: "Product page" });
      }
  });

  navigationLinks = [...navigationLinks, ...discoveredLinks];

  console.log("=== FINAL AVAILABLE PAGES DATABASE ===");
  navigationLinks.forEach(l => {
      console.log(`- PAGE_NAME: "${l.name}" => URL: ${l.url}`);
  });
}
run();
