import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "../lib/firebase-admin";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function testConnections() {
  console.log("🔍 Testing All Connections...");

  // 1. Test S3
  try {
    const s3Command = new ListObjectsV2Command({ Bucket: process.env.AWS_S3_BUCKET_NAME });
    await s3Client.send(s3Command);
    console.log("✅ AWS S3: Connected!");
  } catch (e) {
    console.error("❌ AWS S3: Failed -", (e as Error).message);
  }

  // 2. Test Firebase
  try {
    const testRef = db.collection("test_connection").doc("ping");
    await testRef.set({ timestamp: new Date(), message: "Connection successful" });
    console.log("✅ Firebase Firestore: Connected!");
  } catch (e) {
    console.error("❌ Firebase Firestore: Failed -", (e as Error).message);
  }
}

testConnections();
