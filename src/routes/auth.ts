import { Router } from 'express';
import { register, login, forgotPassword, verifyCode, resetPassword, getMe, changePassword } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyCode);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
export default router;
