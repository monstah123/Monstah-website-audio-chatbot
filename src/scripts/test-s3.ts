import { S3Client, ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function testS3() {
  console.log("🔍 Testing AWS S3 Connection...");
  console.log(`📡 Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);

  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
    });
    const response = await s3Client.send(command);
    
    console.log("✅ Connection Successful!");
    if (response.Contents) {
      console.log(`📂 Found ${response.Contents.length} files in the bucket:`);
      response.Contents.forEach(file => console.log(`   - ${file.Key}`));
    } else {
      console.log("📂 The bucket is empty.");
    }
  } catch (error) {
    console.error("❌ Connection Failed:", (error as Error).message);
  }
}

testS3();
