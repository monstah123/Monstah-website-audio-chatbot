import { db } from "./src/lib/firebase-admin";

async function run() {
  const snapshot = await db.collection("users").get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "speechSensitivity:", data.speechSensitivity, "idleTimeout:", data.idleTimeout);
  });
}
run();
