
import { db } from "../src/lib/firebase-admin";

async function audit() {
  const userId = "petersoncharles"; // I need to find the actual userId
  // Wait, I don't know the userId from the metadata. 
  // It says "petersoncharles" in the path /Users/petersoncharles/Developer/...
  // But Firestore UIDs are usually strings like "pD9k...".
  
  // I'll search for ALL knowledge docs created in the last 15 minutes.
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  console.log("Searching for knowledge docs created after:", fifteenMinutesAgo);
  
  const snapshot = await db.collection("knowledge")
    .where("createdAt", ">=", fifteenMinutesAgo)
    .get();

  if (snapshot.empty) {
    console.log("❌ No new knowledge documents found in the last 15 minutes.");
    return;
  }

  console.log(`✅ Found ${snapshot.size} new knowledge documents!`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- Source: ${data.source} (User: ${data.userId})`);
  });
}

audit().catch(console.error);
