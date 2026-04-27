
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

async function fullSync() {
  const sourceUid = "zYXZQWVdWKPnHiE566SJxWaTqip1";
  const targetUid = "irYbunVg2BUW38Xw5rzsObbXawF2";
  
  const sourceDoc = await db.collection("users").doc(sourceUid).get();
  if (!sourceDoc.exists) {
    console.error("Source user not found!");
    return;
  }
  
  const data = sourceDoc.data();
  console.log("Syncing settings from Peterson (User 2) to Website Account (User 1)...");
  
  await db.collection("users").doc(targetUid).set(data, { merge: true });
  console.log("Success! Both accounts are now identical.");
}

fullSync();
