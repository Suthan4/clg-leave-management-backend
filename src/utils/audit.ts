import AuditLog from '../models/AuditLog';
import mongoose from 'mongoose';

export const createAuditLog = async (
  userId: mongoose.Types.ObjectId,
  action: string,
  entity: string,
  details: string,
  entityId?: mongoose.Types.ObjectId,
  ipAddress?: string
): Promise<void> => {
  try {
    await AuditLog.create({ userId, action, entity, entityId, details, ipAddress });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};
