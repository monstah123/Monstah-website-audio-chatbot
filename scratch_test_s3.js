
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function testUpload() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const key = `test-${Date.now()}.txt`;
  const body = "This is a test upload for logo verification.";

  console.log("Uploading to:", bucketName, key);

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: "text/plain"
    });

    await s3Client.send(command);
    const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log("Success! Test URL:", url);
  } catch (err) {
    console.error("Upload FAILED:", err.message);
  }
}

testUpload();
