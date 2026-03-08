import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();
router.get('/', protect, getSettings);
router.put('/', protect, adminOnly, updateSettings);
export default router;
