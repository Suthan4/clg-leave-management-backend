import { sendLeaveStatusEmail } from '../utils/email';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import Notification from '../models/Notification';
import LeaveType from '../models/LeaveType';
import Leave from '../models/Leave';
import User from '../models/User';

const calculateWorkDays = (start: Date, end: Date, workDays: number[] = [1,2,3,4,5]): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (workDays.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const calculateDays = (start: Date, end: Date): number => {
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const e = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
};

export const createLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveTypeId, startDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;
    const userId = req.user!._id;

    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    if (start > end) {
      res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
      return;
    }

    // ✅ Notice period validation AFTER date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffNotice = Math.ceil(
     (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (leaveType.minNoticeDays && diffNotice < leaveType.minNoticeDays) {
      res.status(400).json({
        success: false,
        message: `Minimum ${leaveType.minNoticeDays} days notice required`
      });
      return;
    }

    // ✅ OVERLAP CHECK HERE
    const overlap = await Leave.findOne({
      userId,
      status: { $in: ['pending_manager', 'pending_admin', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlap) {
      res.status(400).json({
        success: false,
        message: 'You already have a leave request in this period'
      });
      return;
    }

    const isHalfDayBool = isHalfDay === "true" || isHalfDay === true;

    // ✅ Half day must be single day
    if (isHalfDayBool && start.toDateString() !== end.toDateString()) {
      res.status(400).json({
        success: false,
        message: 'Half day leave must be for a single day'
      });
      return;
    }

    const totalDays = isHalfDayBool ? 0.5 : calculateDays(start, end);

    if (totalDays <= 0) {
      res.status(400).json({
        success: false,
        message: 'No working days in selected range'
      });
      return;
    }

    // ✅ Max consecutive validation
    if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
      res.status(400).json({
        success: false,
        message: `Max ${leaveType.maxConsecutiveDays} consecutive days allowed`
      });
      return;
    }

    const user = await User.findById(userId);

    // ✅ Balance check
    const balance = user?.leaveBalances.find(
      b => b.leaveTypeId.toString() === leaveTypeId
    );

    if (balance && balance.remaining < totalDays) {
      res.status(400).json({
        success: false,
        message: 'Insufficient leave balance'
      });
      return;
    }

    const attachments =
      (req.files as Express.Multer.File[])?.map(f => f.path) || [];

    const leave = await Leave.create({
      userId,
      leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      isHalfDay: isHalfDayBool,
      halfDayPeriod,
      attachments
    });

    // ✅ User notification
    await Notification.create({
      userId,
      title: 'Leave Request Submitted',
      message: `Your ${leaveType.name} request for ${totalDays} day(s) has been submitted.`,
      type: 'leave_applied',
      leaveId: leave._id
    });

    // ✅ Admin + Manager notification (optimized)
    const admins = await User.find({
      role: { $in: ['admin', 'manager'] },
      isActive: true
    });

    await Notification.insertMany(
      admins.map(admin => ({
        userId: admin._id,
        title: 'New Leave Request',
        message: `${req.user!.firstName} ${req.user!.lastName} applied for ${leaveType.name} (${totalDays} days)`,
        type: 'leave_applied',
        leaveId: leave._id
      }))
    );

    await createAuditLog(
      userId,
      'CREATE',
      'Leave',
      `Applied for ${leaveType.name}`,
      leave._id
    );

    res.status(201).json({
      success: true,
      message: 'Leave request submitted',
      leave
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create leave'
    });
  }
};


export const getMyLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, year, page = 1, limit = 10 } = req.query;
    const filter: any = { userId: req.user!._id };
    if (status) filter.status = status;
    if (year) {
      filter.startDate = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
    }

    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter).populate('leaveTypeId', 'name color code').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);

    res.json({ success: true, leaves, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLeaveById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate(
        'leaveTypeId',
        'name color code defaultDays maxConsecutiveDays minNoticeDays requiresDocument carryForward maxCarryForwardDays description'
      )
      .populate('userId', 'firstName lastName email department position')
      .populate('reviewedBy', 'firstName lastName')
      .populate('managerApprovedBy', 'firstName lastName');

    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }

    if (leave.userId._id.toString() !== req.user!._id.toString() && !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }

    res.json({ success: true, leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }
    if (leave.userId.toString() !== req.user!._id.toString()) { res.status(403).json({ success: false, message: 'Not authorized' }); return; }
    if (leave.status !== 'pending_manager') { res.status(400).json({ success: false, message: 'Only pending leaves can be cancelled' }); return; }

    leave.status = 'cancelled';
    await leave.save();
    res.json({ success: true, message: 'Leave cancelled', leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaves = await Leave.find({ status: { $in: ['pending_manager', 'pending_admin'] } })
      .populate('userId', 'firstName lastName email department position')
      .populate('leaveTypeId', 'name color code')
      .populate('managerApprovedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ success: true, leaves, total: leaves.length });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, department, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (startDate && endDate) filter.startDate = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };

    if (department || userId) {
      const userFilter: any = {};
      if (department) userFilter.department = department;
      if (userId) userFilter._id = userId;
      const users = await User.find(userFilter).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }

    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter).populate('userId', 'firstName lastName email department position').populate('leaveTypeId', 'name color code').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);

    res.json({ success: true, leaves, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveRejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, comment } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      res.status(400).json({ success: false, message: 'Invalid action' }); return;
    }

    const leave = await Leave.findById(req.params.id).populate('userId');
    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }

    const reviewerRole = req.user!.role;
    const leaveUser = leave.userId as any;

    // Load org settings to check approval levels
    const Settings = (await import('../models/Settings')).default;
    const settings = await Settings.findOne();
    const approvalLevels = settings?.leaveApprovalLevels || 1;

    // ── 1-LEVEL: any admin or manager can fully approve/reject ──
    if (approvalLevels === 1) {
      if (leave.status !== 'pending_manager') {
        res.status(400).json({ success: false, message: 'Leave is not in pending state' }); return;
      }
      leave.status = action as any;
      leave.reviewedBy = req.user!._id as any;
      leave.reviewedOn = new Date();
      leave.adminComment = comment;
      await leave.save();

      if (action === 'approved') {
        await User.findByIdAndUpdate(leave.userId, {
          $inc: { 'leaveBalances.$[elem].used': leave.totalDays, 'leaveBalances.$[elem].remaining': -leave.totalDays }
        }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });
      }
      await Notification.create({ userId: leaveUser._id, title: `Leave ${action}`, message: `Your leave request has been ${action}.${comment ? ' Comment: ' + comment : ''}`, type: action === 'approved' ? 'leave_approved' : 'leave_rejected', leaveId: leave._id });
      const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
      try { await sendLeaveStatusEmail(leaveUser.email, action, dateStr, comment); } catch (_) {}
      await createAuditLog(req.user!._id, action.toUpperCase(), 'Leave', `Leave ${action} for ${leaveUser.email}`, leave._id);
      res.json({ success: true, message: `Leave ${action} successfully`, leave });
      return;
    }

    // ── 2-LEVEL: Manager approves first (pending → pending_admin), then Admin gives final decision ──
    if (approvalLevels === 2) {

      // REJECTION — allowed by anyone (manager or admin) at any stage
      if (action === 'rejected') {
        if (!['pending_manager', 'pending_admin'].includes(leave.status)) {
          res.status(400).json({ success: false, message: 'Leave cannot be rejected at this stage' }); return;
        }
        leave.status = 'rejected' as any;
        leave.reviewedBy = req.user!._id as any;
        leave.reviewedOn = new Date();
        leave.adminComment = comment;
        await leave.save();
        await Notification.create({ userId: leaveUser._id, title: 'Leave Rejected', message: `Your leave has been rejected.${comment ? ' Reason: ' + comment : ''}`, type: 'leave_rejected', leaveId: leave._id });
        const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
        try { await sendLeaveStatusEmail(leaveUser.email, 'rejected', dateStr, comment); } catch (_) {}
        await createAuditLog(req.user!._id, 'REJECTED', 'Leave', `Leave rejected for ${leaveUser.email}`, leave._id);
        res.json({ success: true, message: 'Leave rejected', leave });
        return;
      }

      // APPROVAL - Step 1: Manager approves (pending → pending_admin)
      if (leave.status === 'pending_manager') {
        if (reviewerRole === 'manager') {
          leave.status = 'pending_admin' as any;
          leave.managerApprovedBy = req.user!._id as any;
          leave.managerApprovedOn = new Date();
          leave.managerComment = comment;
          await leave.save();

          // Notify all admins to give final approval
          const admins = await User.find({ role: 'admin', isActive: true });
          for (const admin of admins) {
            await Notification.create({ userId: admin._id, title: '⏳ Final Approval Needed', message: `${leaveUser.firstName} ${leaveUser.lastName}'s leave was approved by manager. Your final approval is required.`, type: 'leave_applied', leaveId: leave._id });
          }
          // Notify employee of intermediate progress
          await Notification.create({ userId: leaveUser._id, title: '✅ Manager Approved — Awaiting Admin', message: 'Your leave was approved by your manager. Waiting for admin final approval.', type: 'leave_approved', leaveId: leave._id });
          await createAuditLog(req.user!._id, 'APPROVED', 'Leave', `Manager Level-1 approved for ${leaveUser.email}`, leave._id);
          res.json({ success: true, message: 'Manager approved (Level 1). Leave is now awaiting admin final approval.', leave });
          return;
        }

        // Admin can also directly approve from pending (bypasses manager step)
        if (reviewerRole === 'admin') {
          leave.status = 'approved' as any;
          leave.reviewedBy = req.user!._id as any;
          leave.reviewedOn = new Date();
          leave.adminComment = comment;
          await leave.save();
          await User.findByIdAndUpdate(leave.userId, {
            $inc: { 'leaveBalances.$[elem].used': leave.totalDays, 'leaveBalances.$[elem].remaining': -leave.totalDays }
          }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });
          await Notification.create({ userId: leaveUser._id, title: 'Leave Approved ✅', message: `Your leave has been fully approved.${comment ? ' Comment: ' + comment : ''}`, type: 'leave_approved', leaveId: leave._id });
          const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
          try { await sendLeaveStatusEmail(leaveUser.email, 'approved', dateStr, comment); } catch (_) {}
          await createAuditLog(req.user!._id, 'APPROVED', 'Leave', `Admin direct approval for ${leaveUser.email}`, leave._id);
          res.json({ success: true, message: 'Leave fully approved', leave });
          return;
        }
      }

      // APPROVAL - Step 2: Admin gives final approval (pending_admin → approved)
      if (leave.status === 'pending_admin') {
        if (reviewerRole !== 'admin') {
          res.status(403).json({ success: false, message: 'This leave is awaiting admin final approval. Only an admin can approve it now.' }); return;
        }
        leave.status = 'approved' as any;
        leave.reviewedBy = req.user!._id as any;
        leave.reviewedOn = new Date();
        leave.adminComment = comment;
        await leave.save();
        await User.findByIdAndUpdate(leave.userId, {
          $inc: { 'leaveBalances.$[elem].used': leave.totalDays, 'leaveBalances.$[elem].remaining': -leave.totalDays }
        }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });
        await Notification.create({ userId: leaveUser._id, title: 'Leave Fully Approved ✅', message: `Your leave has been fully approved by admin.${comment ? ' Comment: ' + comment : ''}`, type: 'leave_approved', leaveId: leave._id });
        const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
        try { await sendLeaveStatusEmail(leaveUser.email, 'approved', dateStr, comment); } catch (_) {}
        await createAuditLog(req.user!._id, 'APPROVED', 'Leave', `Admin final approval for ${leaveUser.email}`, leave._id);
        res.json({ success: true, message: 'Leave fully approved by admin', leave });
        return;
      }

      res.status(400).json({ success: false, message: `Leave is in "${leave.status}" state and cannot be actioned` });
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid approval level configuration' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to action leave' });
  }
};
