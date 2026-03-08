import { Response } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 50, entity } = req.query;
    const filter: any = {};
    if (entity) filter.entity = entity;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter).populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
    res.json({ success: true, logs, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
