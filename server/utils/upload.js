import multer from 'multer';

// Multer memory storage configuration (buffers file in memory for MinIO/S3 object storage streaming)
const storage = multer.memoryStorage();

// File filter: accept all uploads without rejecting file types so image uploading is not validated
const fileFilter = (_req, _file, cb) => {
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  },
  fileFilter
}).single('image');

export default uploadMiddleware;
