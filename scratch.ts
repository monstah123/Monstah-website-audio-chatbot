import { db } from "./src/lib/firebase-admin";

async function run() {
  const snapshot = await db.collection("knowledge").get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.source && data.source.toLowerCase().includes("knee")) {
      console.log(data.source, data.content ? "Has Content" : "No Content");
    }
  });
}
run();
