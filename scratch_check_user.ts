
import { db } from "./src/lib/firebase-admin";

async function checkUser() {
  const users = await db.collection("users").get();
  users.forEach(doc => {
    const data = doc.data();
    if (data.firstMessage && data.firstMessage.includes("Peterson")) {
      console.log("Found user:", doc.id);
      console.log("Data:", JSON.stringify(data, null, 2));
    }
  });
}

checkUser();
