import { Response } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

// Returns a paginated list of audit logs, optionally filtered by entity type
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Default to page 1 with 50 results per page if not specified
    const { page = 1, limit = 50, entity } = req.query;
    const filter: any = {};

    // Only filter by entity if the query param is provided
    if (entity) filter.entity = entity;

    // Count total matching documents for pagination metadata
    const total = await AuditLog.countDocuments(filter);

    // Fetch logs with user info populated, sorted newest-first, with skip/limit for pagination
    const logs = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName email') // Attach user name and email to each log
      .sort({ createdAt: -1 })                        // Most recent logs first
      .skip((+page - 1) * +limit)                    // Skip records for previous pages
      .limit(+limit);                                 // Limit to requested page size

    res.json({
      success: true,
      logs,
      total,
      page: +page,
      totalPages: Math.ceil(total / +limit), // Calculate total number of pages
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};