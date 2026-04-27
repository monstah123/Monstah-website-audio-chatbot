import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1"; // I found this from the earlier script
  
  let navigationLinks: any[] = [];
  let discoveredLinks: any[] = [];
  
  const settingsDoc = await db.collection("users").doc(userId).get();
  if (settingsDoc.exists) {
    const settings = settingsDoc.data();
    if (Array.isArray(settings?.navigationLinks)) {
      navigationLinks = settings.navigationLinks;
    } else if (settings?.navigationLinks && typeof settings.navigationLinks === 'object') {
      navigationLinks = Object.entries(settings.navigationLinks).map(
        ([name, url]) => ({ name, url: url as string })
      );
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
      const description = data.content ? data.content.substring(0, 80).replace(/\n/g, ' ') + "..." : "Product page";
      discoveredLinks.push({ name, url: data.source, description });
    }
  });
  
  const allLinks = [...navigationLinks, ...discoveredLinks];
  console.log("Total links:", allLinks.length);
  
  const kneeLinks = allLinks.filter(l => l.name.toLowerCase().includes("knee") || l.url.toLowerCase().includes("knee"));
  console.log("Knee links:", JSON.stringify(kneeLinks, null, 2));
}
run();
