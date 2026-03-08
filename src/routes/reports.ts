import { Router } from 'express';
import { getLeaveReport, getDashboardStats, getCalendarData } from '../controllers/reportController';
import { protect, managerOrAdmin } from '../middleware/auth';

const router = Router();
router.use(protect);
router.get('/dashboard', getDashboardStats);
router.get('/leaves', managerOrAdmin, getLeaveReport);
router.get('/calendar', getCalendarData);
export default router;
