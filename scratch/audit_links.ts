import { db } from "../src/lib/firebase-admin";

async function checkLinks() {
  try {
    console.log("Checking Knowledge Base for unique URLs...");
    const snapshot = await db.collection("knowledge").get();
    const uniqueSources = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.source && data.source.startsWith("http")) {
        uniqueSources.add(data.source);
      }
    });

    console.log("\n--- FOUND UNIQUE URLs ---");
    Array.from(uniqueSources).sort().forEach(url => console.log(url));
    console.log("-------------------------\n");
    
    process.exit(0);
  } catch (error) {
    console.error("Error checking links:", error);
    process.exit(1);
  }
}

checkLinks();
