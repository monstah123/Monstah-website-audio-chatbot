
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

async function syncUsers() {
  const ql = [
    {
      "label": "Knee Wraps",
      "action": "https://monstahgymwear.com/product/monstah-heavy-duty-knee-wraps/"
    }
  ];

  const uids = ["irYbunVg2BUW38Xw5rzsObbXawF2", "zYXZQWVdWKPnHiE566SJxWaTqip1"];
  
  for (const uid of uids) {
    await db.collection("users").doc(uid).set({
      quickLinks: ql
    }, { merge: true });
    console.log("Updated user:", uid);
  }
}

syncUsers();
