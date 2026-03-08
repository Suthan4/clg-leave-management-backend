import { Router, Response } from 'express';
import Organization from '../models/Organization';
import { protect as authenticate, adminOnly as authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    let org = await Organization.findOne();
    if (!org) org = await Organization.create({ name: 'My Organization' });
    res.json(org);
  } catch { res.status(500).json({ message: 'Failed to get organization' }); }
});

router.put('/', authorize, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let org = await Organization.findOne();
    if (!org) {
      org = await Organization.create(req.body);
    } else {
      Object.assign(org, req.body);
      await org.save();
    }
    res.json(org);
  } catch { res.status(500).json({ message: 'Failed to update organization' }); }
});

export default router;
