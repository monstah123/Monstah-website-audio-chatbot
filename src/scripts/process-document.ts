import { db } from "../lib/firebase-admin";
import { getFileFromS3 } from "../lib/s3";
import { OpenAI } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processDocument(fileName: string) {
  console.log(`📂 Processing document: ${fileName}`);

  try {
    // 1. Get file from S3
    const bucket = process.env.AWS_S3_BUCKET_NAME || "";
    const content = await getFileFromS3(bucket, fileName);

    if (!content) throw new Error("No content found in file");

    // 2. Generate Embedding via OpenAI
    console.log("🧠 Generating embeddings...");
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content.substring(0, 8000), // OpenAI limit approx
    });

    const vector = embeddingResponse.data[0].embedding;

    // 3. Save to Firestore Knowledge Base
    console.log("💾 Saving to Firestore...");
    await db.collection("knowledge").add({
      fileName,
      content: content.substring(0, 5000), // Store snippet
      embedding: vector, // Firestore supports vector search on arrays or vectorValue
      createdAt: new Date(),
    });

    console.log("✅ Document successfully ingested!");
  } catch (error) {
    console.error("❌ Processing Error:", error);
  }
}

// Example: ts-node src/scripts/process-document.ts my-product-list.csv
const file = process.argv[2];
if (file) {
  processDocument(file);
} else {
  console.log("Please provide a filename from your S3 bucket.");
}
