import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();
router.get('/', protect, adminOnly, getAuditLogs);
export default router;
