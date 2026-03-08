import { Router } from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, updateProfile, getDepartments } from '../controllers/userController';
import { protect, adminOnly } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({ destination: 'uploads/avatars', filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname)) });
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();
router.use(protect);
router.get('/', adminOnly, getAllUsers);
router.get('/departments', getDepartments);
router.get('/:id', getUserById);
router.post('/', adminOnly, createUser);
router.put('/profile', upload.single('avatar'), updateProfile);
router.put('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);
export default router;
