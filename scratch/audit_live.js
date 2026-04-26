
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    console.error("❌ Firebase Error: FIREBASE_PROJECT_ID is missing.");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

async function audit() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  console.log("Searching for knowledge docs created after:", tenMinutesAgo);
  
  const snapshot = await db.collection("knowledge")
    .where("createdAt", ">=", tenMinutesAgo)
    .get();

  if (snapshot.empty) {
    console.log("❌ No new training documents found in the last 10 minutes.");
    return;
  }

  console.log(`✅ SUCCESS! Found ${snapshot.size} new documents trained in the last 10 minutes.`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- Trained URL: ${data.source}`);
    console.log(`  Preview: ${data.content.substring(0, 100)}...`);
    console.log('---');
  });
}

audit().catch(console.error);
