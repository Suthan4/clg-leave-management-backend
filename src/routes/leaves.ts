import { Router } from 'express';
import { createLeave, getMyLeaves, getLeaveById, cancelLeave, getPendingLeaves, getAllLeaves, approveRejectLeave } from '../controllers/leaveController';
import { protect, managerOrAdmin } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({ destination: 'uploads/documents', filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname)) });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(protect);
router.post('/', upload.array('attachments', 3), createLeave);
router.get('/my', getMyLeaves);
router.get('/pending', managerOrAdmin, getPendingLeaves);
router.get('/all', managerOrAdmin, getAllLeaves);
router.get('/:id', getLeaveById);
router.put('/:id/cancel', cancelLeave);
router.put('/:id/review', managerOrAdmin, approveRejectLeave);
export default router;
