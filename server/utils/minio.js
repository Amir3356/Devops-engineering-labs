import * as Minio from 'minio';

/**
 * Validates and retrieves MinIO object storage configuration strictly from the environment.
 * Deliberately contains NO hardcoded fallback credentials, endpoints, or bucket names.
 */
function getMinioConfig() {
  const endPoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucketName = process.env.MINIO_BUCKET_NAME;
  const publicUrl = process.env.MINIO_PUBLIC_URL;

  const missing = [];
  if (!endPoint) missing.push('MINIO_ENDPOINT');
  if (!port) missing.push('MINIO_PORT');
  if (!accessKey) missing.push('MINIO_ACCESS_KEY');
  if (!secretKey) missing.push('MINIO_SECRET_KEY');
  if (!bucketName) missing.push('MINIO_BUCKET_NAME');
  if (!publicUrl) missing.push('MINIO_PUBLIC_URL');

  if (missing.length > 0) {
    throw new Error(
      `[MinIO Configuration Error] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Please configure them in server/.env or the container environment.'
    );
  }

  return {
    endPoint: endPoint.trim(),
    port: parseInt(port.trim(), 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: accessKey.trim(),
    secretKey: secretKey.trim(),
    bucketName: bucketName.trim(),
    publicUrl: publicUrl.trim().replace(/\/+$/, '')
  };
}

let clientInstance = null;
let cachedConfig = null;
let bucketReady = false;

/**
 * Returns the MinIO client and active configuration.
 * Lazily initializes and validates environment configuration on first use.
 */
export function getMinioClient() {
  if (!clientInstance) {
    cachedConfig = getMinioConfig();
    clientInstance = new Minio.Client({
      endPoint: cachedConfig.endPoint,
      port: cachedConfig.port,
      useSSL: cachedConfig.useSSL,
      accessKey: cachedConfig.accessKey,
      secretKey: cachedConfig.secretKey
    });
  }
  return { client: clientInstance, config: cachedConfig };
}

/**
 * Backward compatibility client proxy.
 */
export const minioClient = new Proxy({}, {
  get(_target, prop) {
    const { client } = getMinioClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

/**
 * Current target bucket name from environment.
 */
export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME;

/**
 * Ensures the target MinIO bucket exists and has a public read policy
 * so that stored images can be rendered directly by web browsers.
 */
export async function ensureBucket() {
  if (bucketReady) return;

  const { client, config } = getMinioClient();
  const bucket = config.bucketName;

  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1');
      console.log(`[MinIO] Bucket "${bucket}" created successfully.`);
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
          Resource: [`arn:aws:s3:::${bucket}/*`]
        }
      ]
    };

    await client.setBucketPolicy(bucket, JSON.stringify(policy));
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
 * @returns {Promise<{ url: string, imageUrl: string, objectName: string, bucket: string, size: number }>}
 */
export async function uploadToMinio(fileBuffer, originalName, mimeType) {
  const { client, config } = getMinioClient();
  await ensureBucket();

  const ext = originalName && originalName.includes('.')
    ? `.${originalName.split('.').pop()}`
    : '.jpg';
  const objectName = `products/prod-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  await client.putObject(
    config.bucketName,
    objectName,
    fileBuffer,
    fileBuffer.length,
    { 'Content-Type': mimeType || 'image/jpeg' }
  );

  const fileUrl = `${config.publicUrl}/${config.bucketName}/${objectName}`;

  return {
    url: fileUrl,
    imageUrl: fileUrl,
    objectName,
    bucket: config.bucketName,
    size: fileBuffer.length
  };
}

export default {
  minioClient,
  getMinioClient,
  ensureBucket,
  uploadToMinio,
  BUCKET_NAME
};
