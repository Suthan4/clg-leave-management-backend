import { Router } from 'express';
import { getLeaveTypes, getAllLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../controllers/leaveTypeController';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();
router.get('/', protect, getLeaveTypes);
router.get('/all', protect, adminOnly, getAllLeaveTypes);
router.post('/', protect, adminOnly, createLeaveType);
router.put('/:id', protect, adminOnly, updateLeaveType);
router.delete('/:id', protect, adminOnly, deleteLeaveType);
export default router;
