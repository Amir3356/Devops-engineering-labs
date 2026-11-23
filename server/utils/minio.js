import * as Minio from 'minio';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10);
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'ecommerce-products';
const publicUrl = process.env.MINIO_PUBLIC_URL || `http://localhost:${minioPort}`;

export const minioClient = new Minio.Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey
});

let bucketReady = false;

/**
 * Ensures the target MinIO bucket exists and has a public read policy
 * so that stored images can be rendered directly by web browsers.
 */
export async function ensureBucket() {
  if (bucketReady) return;

  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`[MinIO] Bucket "${BUCKET_NAME}" created successfully.`);
    }

    // Public read policy for web-accessible product images
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }
      ]
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    bucketReady = true;
  } catch (err) {
    console.warn(`[MinIO] Bucket initialization notice:`, err.message);
  }
}

/**
 * Uploads an in-memory image buffer to MinIO object storage.
 * @param {Buffer} fileBuffer - In-memory image buffer from Multer
 * @param {string} originalName - Original filename for extension extraction
 * @param {string} mimeType - Image mime type
 * @returns {Promise<{ url: string, objectName: string, bucket: string, size: number }>}
 */
export async function uploadToMinio(fileBuffer, originalName, mimeType) {
  await ensureBucket();

  const ext = originalName && originalName.includes('.')
    ? `.${originalName.split('.').pop()}`
    : '.jpg';
  const objectName = `products/prod-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  await minioClient.putObject(
    BUCKET_NAME,
    objectName,
    fileBuffer,
    fileBuffer.length,
    { 'Content-Type': mimeType || 'image/jpeg' }
  );

  const fileUrl = `${publicUrl}/${BUCKET_NAME}/${objectName}`;

  return {
    url: fileUrl,
    imageUrl: fileUrl,
    objectName,
    bucket: BUCKET_NAME,
    size: fileBuffer.length
  };
}

export default {
  minioClient,
  ensureBucket,
  uploadToMinio,
  BUCKET_NAME
};
