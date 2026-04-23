import { uploadFileToS3 } from "../lib/s3";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sampleData = `
MONSTAH PRODUCT CATALOG 2026
---------------------------
1. Monstah Ultra Bass Headphones
   Price: $299.99
   Features: Active Noise Cancelling, 40-hour battery, Premium Leather.

2. Monstah Sonic Studio Mic
   Price: $149.50
   Features: XLR & USB support, Zero-latency monitoring, Gold-plated capsule.

3. Monstah Glow Keyboard (Mechanical)
   Price: $89.00
   Features: RGB lighting, Cherry MX Blue switches, Aluminum frame.
`;

async function uploadTestFile() {
  const bucket = process.env.AWS_S3_BUCKET_NAME || "";
  const key = "test-product-catalog.txt";
  
  console.log(`📤 Uploading ${key} to S3...`);
  try {
    await uploadFileToS3(bucket, key, sampleData);
    console.log("✅ Upload Successful!");
  } catch (error) {
    console.error("❌ Upload Failed:", (error as Error).message);
  }
}

uploadTestFile();
