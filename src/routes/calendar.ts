import { Router, Response } from 'express';
import { protect as authenticate, AuthRequest } from '../middleware/auth';
import Leave from '../models/Leave';
import User from '../models/User';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, department } = req.query;
    const m = parseInt(month as string) || new Date().getMonth() + 1;
    const y = parseInt(year as string) || new Date().getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    const filter: Record<string, unknown> = {
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    };

    if (department) {
      const users = await User.find({ department }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    } else if (req.user!.role === 'employee') {
      const user = await User.findById(req.user!._id).select('department');
      const teammates = await User.find({ department: user?.department }).select('_id');
      filter.userId = { $in: teammates.map(u => u._id) };
    }

    const leaves = await Leave.find(filter)
      .populate('userId', 'name department')
      .populate('leaveTypeId', 'name color');

    res.json(leaves);
  } catch { res.status(500).json({ message: 'Failed to get calendar' }); }
});

export default router;
