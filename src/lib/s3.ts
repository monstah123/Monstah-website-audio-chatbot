import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const getFileFromS3 = async (bucket: string, key: string) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Body?.transformToString();
};

export const uploadFileToS3 = async (bucket: string, key: string, body: Buffer | string) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  });

  return await s3Client.send(command);
};

export { s3Client };
