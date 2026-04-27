import { db } from "./src/lib/firebase-admin";

async function run() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const snapshot = await db.collection("knowledge").where("userId", "==", userId).get();
  console.log("Total knowledge chunks:", snapshot.size);
  
  let first200Count = 0;
  let hasKneeInFirst200 = false;
  let hasKneeInAll = false;
  
  const snap200 = await db.collection("knowledge").where("userId", "==", userId).limit(200).get();
  snap200.forEach(d => {
      const data = d.data();
      if ((data.content || "").toLowerCase().includes("knee wraps") || (data.source || "").toLowerCase().includes("knee")) {
          hasKneeInFirst200 = true;
      }
  });

  snapshot.forEach(d => {
    const data = d.data();
    if ((data.content || "").toLowerCase().includes("knee wraps") || (data.source || "").toLowerCase().includes("knee")) {
        hasKneeInAll = true;
    }
  });

  console.log("Has knee wraps in first 200?", hasKneeInFirst200);
  console.log("Has knee wraps in all?", hasKneeInAll);
}
run();
