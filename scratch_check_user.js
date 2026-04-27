
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  });
}

const db = admin.firestore();

async function checkUser() {
  const users = await db.collection("users").get();
  console.log(`Checking ${users.size} users...`);
  users.forEach(doc => {
    const data = doc.data();
    if (data.firstMessage && data.firstMessage.includes("Peterson")) {
      console.log("Found user:", doc.id);
      console.log("Data:", JSON.stringify(data, null, 2));
    }
  });
}

checkUser();
