import { randomUUID } from "node:crypto";
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`bucket criado: ${bucket}`);
  }
}

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function saveImage(folder, file) {
  const key = `${folder}/${randomUUID()}.${extensions[file.mimetype]}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
  return key;
}

export async function getImage(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { stream: res.Body, contentType: res.ContentType };
}

export const allowedImageTypes = Object.keys(extensions);
