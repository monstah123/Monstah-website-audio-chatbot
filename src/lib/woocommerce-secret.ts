import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedSecret = {
  encryptedSecret: string;
  secretIv: string;
  secretAuthTag: string;
};

function getEncryptionKey() {
  const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_PRIVATE_KEY is required to protect WooCommerce webhook secrets");
  }
  return createHash("sha256")
    .update("woocommerce-webhook-secret:v1:")
    .update(serviceAccountKey)
    .digest();
}

export function encryptWooCommerceSecret(secret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encryptedSecret = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedSecret: encryptedSecret.toString("base64"),
    secretIv: iv.toString("base64"),
    secretAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptWooCommerceSecret(data: Partial<EncryptedSecret>) {
  if (!data.encryptedSecret || !data.secretIv || !data.secretAuthTag) {
    throw new Error("WooCommerce webhook secret is not configured correctly");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(data.secretIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(data.secretAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data.encryptedSecret, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
