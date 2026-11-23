import multer from 'multer';

// Multer memory storage configuration (buffers file in memory for MinIO/S3 object storage streaming)
const storage = multer.memoryStorage();

// File filter to restrict uploads strictly to images
const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only valid image files (JPG, PNG, WEBP, GIF) are allowed'), false);
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter
}).single('image');

export default uploadMiddleware;
