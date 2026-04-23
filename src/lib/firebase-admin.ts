import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    console.error("❌ Firebase Error: FIREBASE_PROJECT_ID is missing. Current ENV keys:", Object.keys(process.env).filter(k => k.startsWith("FIREBASE")));
  }

  const config = {
    projectId,
    clientEmail,
    privateKey,
    // Add snake_case for compatibility
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };

  admin.initializeApp({
    credential: admin.credential.cert(config as any),
  });
}

const db = admin.firestore();

export { db, admin };
