import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const settingsDoc = await db.collection("users").doc(userId).get();
  const settings = settingsDoc.data();
  console.log("=== USER SAVED NAVIGATION LINKS ===");
  console.log(JSON.stringify(settings?.navigationLinks, null, 2));
}
run();
