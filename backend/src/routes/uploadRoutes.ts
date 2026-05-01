import express from 'express';
import multer from 'multer';
import { protect } from 'src/middleware/authMiddleware';
import { uploadFile, generateSignedUrl } from 'src/controllers/uploadController';

const router = express.Router();

// Memory storage is best for cloud uploads as we don't need to save locally
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Protected route for security
router.use(protect);

router.post('/', upload.single('file'), uploadFile);
router.post('/signed-url', generateSignedUrl);

export default router;
