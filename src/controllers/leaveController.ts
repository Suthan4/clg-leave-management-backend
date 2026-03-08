import { sendLeaveStatusEmail } from '../utils/email';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import Notification from '../models/Notification';
import LeaveType from '../models/LeaveType';
import Leave from '../models/Leave';
import User from '../models/User';

// Counts working days between two dates based on configurable work days (defaults to Mon–Fri)
const calculateWorkDays = (start: Date, end: Date, workDays: number[] = [1,2,3,4,5]): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (workDays.includes(current.getDay())) count++; // getDay() returns 0 (Sun) – 6 (Sat)
    current.setDate(current.getDate() + 1);
  }
  return count;
};

// Counts calendar days (inclusive) between two dates using UTC to avoid DST issues
const calculateDays = (start: Date, end: Date): number => {
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const e = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1; // +1 to make the range inclusive
};

// Creates a new leave request with full validation
export const createLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveTypeId, startDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;
    const userId = req.user!._id;

    // Verify the requested leave type exists
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      res.status(404).json({ success: false, message: 'Leave type not found' });
      return;
    }

    // Normalise both dates to midnight to avoid time-of-day comparison issues
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
      return;
    }

    // Ensure the employee gives sufficient advance notice as required by the leave type
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffNotice = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (leaveType.minNoticeDays && diffNotice < leaveType.minNoticeDays) {
      res.status(400).json({
        success: false,
        message: `Minimum ${leaveType.minNoticeDays} days notice required`,
      });
      return;
    }

    // Check if the user already has an overlapping leave (pending or approved)
    const overlap = await Leave.findOne({
      userId,
      status: { $in: ['pending_manager', 'pending_admin', 'approved'] },
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }], // Any date range overlap
    });

    if (overlap) {
      res.status(400).json({ success: false, message: 'You already have a leave request in this period' });
      return;
    }

    // Coerce half-day flag to boolean from possible string value (form data sends strings)
    const isHalfDayBool = isHalfDay === "true" || isHalfDay === true;

    // Half-day leave must span exactly one day
    if (isHalfDayBool && start.toDateString() !== end.toDateString()) {
      res.status(400).json({ success: false, message: 'Half day leave must be for a single day' });
      return;
    }

    // Half day counts as 0.5 days; otherwise count full calendar days
    const totalDays = isHalfDayBool ? 0.5 : calculateDays(start, end);

    if (totalDays <= 0) {
      res.status(400).json({ success: false, message: 'No working days in selected range' });
      return;
    }

    // Reject if the requested duration exceeds the leave type's consecutive day limit
    if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
      res.status(400).json({
        success: false,
        message: `Max ${leaveType.maxConsecutiveDays} consecutive days allowed`,
      });
      return;
    }

    const user = await User.findById(userId);

    // Check the user's available leave balance for this leave type
    const balance = user?.leaveBalances.find(b => b.leaveTypeId.toString() === leaveTypeId);
    if (balance && balance.remaining < totalDays) {
      res.status(400).json({ success: false, message: 'Insufficient leave balance' });
      return;
    }

    // Collect uploaded file paths if any attachments were provided
    const attachments = (req.files as Express.Multer.File[])?.map(f => f.path) || [];

    // Persist the leave record — status defaults to 'pending_manager'
    const leave = await Leave.create({
      userId, leaveTypeId, startDate: start, endDate: end,
      totalDays, reason, isHalfDay: isHalfDayBool, halfDayPeriod, attachments,
    });

    // Notify the applying employee that their request was submitted
    await Notification.create({
      userId,
      title: 'Leave Request Submitted',
      message: `Your ${leaveType.name} request for ${totalDays} day(s) has been submitted.`,
      type: 'leave_applied',
      leaveId: leave._id,
    });

    // Notify all admins and managers so they can act on the new request
    const admins = await User.find({ role: { $in: ['admin', 'manager'] }, isActive: true });
    await Notification.insertMany(
      admins.map(admin => ({
        userId: admin._id,
        title: 'New Leave Request',
        message: `${req.user!.firstName} ${req.user!.lastName} applied for ${leaveType.name} (${totalDays} days)`,
        type: 'leave_applied',
        leaveId: leave._id,
      }))
    );

    await createAuditLog(userId, 'CREATE', 'Leave', `Applied for ${leaveType.name}`, leave._id);

    res.status(201).json({ success: true, message: 'Leave request submitted', leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create leave' });
  }
};

// Returns the authenticated user's own leave history with optional filters
export const getMyLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, year, page = 1, limit = 10 } = req.query;
    const filter: any = { userId: req.user!._id }; // Scope results to the logged-in user only

    if (status) filter.status = status;

    // Filter leaves that start within the given calendar year
    if (year) {
      filter.startDate = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
    }

    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter)
      .populate('leaveTypeId', 'name color code') // Include leave type details for display
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, leaves, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns a single leave by ID; enforces ownership or role-based access
export const getLeaveById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('leaveTypeId', 'name color code defaultDays maxConsecutiveDays minNoticeDays requiresDocument carryForward maxCarryForwardDays description')
      .populate('userId', 'firstName lastName email department position')
      .populate('reviewedBy', 'firstName lastName')         // Admin who gave final decision
      .populate('managerApprovedBy', 'firstName lastName'); // Manager who approved at level 1

    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }

    // Employees can only view their own leaves; admins/managers can view all
    if (leave.userId._id.toString() !== req.user!._id.toString() && !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }

    res.json({ success: true, leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Allows the owner to cancel a leave that is still pending manager review
export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }

    // Only the employee who applied can cancel their own leave
    if (leave.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }

    // Can only cancel while still pending — not after approval/rejection
    if (leave.status !== 'pending_manager') {
      res.status(400).json({ success: false, message: 'Only pending leaves can be cancelled' }); return;
    }

    leave.status = 'cancelled';
    await leave.save();
    res.json({ success: true, message: 'Leave cancelled', leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns all leaves that are awaiting manager or admin action (for the review queue)
export const getPendingLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaves = await Leave.find({ status: { $in: ['pending_manager', 'pending_admin'] } })
      .populate('userId', 'firstName lastName email department position')
      .populate('leaveTypeId', 'name color code')
      .populate('managerApprovedBy', 'firstName lastName') // Shows who already approved at level 1
      .sort({ createdAt: -1 });
    res.json({ success: true, leaves, total: leaves.length });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns all leaves across the organisation with rich filtering options
export const getAllLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, department, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const filter: any = {};

    if (status) filter.status = status;

    // Date range filter on startDate field
    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    // If filtering by department or specific user, resolve their user IDs first
    if (department || userId) {
      const userFilter: any = {};
      if (department) userFilter.department = department;
      if (userId) userFilter._id = userId;
      const users = await User.find(userFilter).select('_id');
      filter.userId = { $in: users.map(u => u._id) }; // Filter leaves to only matching users
    }

    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter)
      .populate('userId', 'firstName lastName email department position')
      .populate('leaveTypeId', 'name color code')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, leaves, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handles leave approval or rejection, supporting both 1-level and 2-level approval flows
export const approveRejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, comment } = req.body;

    // Only 'approved' or 'rejected' are valid actions
    if (!['approved', 'rejected'].includes(action)) {
      res.status(400).json({ success: false, message: 'Invalid action' }); return;
    }

    const leave = await Leave.findById(req.params.id).populate('userId');
    if (!leave) { res.status(404).json({ success: false, message: 'Leave not found' }); return; }

    const reviewerRole = req.user!.role;
    const leaveUser = leave.userId as any;

    // Load the organisation's approval level setting (1 = single approver, 2 = manager then admin)
    const Settings = (await import('../models/Settings')).default;
    const settings = await Settings.findOne();
    const approvalLevels = settings?.leaveApprovalLevels || 1;

    // ── 1-LEVEL FLOW: any admin or manager can fully approve or reject ──────────────
    if (approvalLevels === 1) {
      if (leave.status !== 'pending_manager') {
        res.status(400).json({ success: false, message: 'Leave is not in pending state' }); return;
      }

      leave.status = action as any;
      leave.reviewedBy = req.user!._id as any;
      leave.reviewedOn = new Date();
      leave.adminComment = comment;
      await leave.save();

      // Deduct from the user's leave balance when approved
      if (action === 'approved') {
        await User.findByIdAndUpdate(leave.userId, {
          $inc: {
            'leaveBalances.$[elem].used': leave.totalDays,
            'leaveBalances.$[elem].remaining': -leave.totalDays,
          },
        }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });
      }

      // Notify the employee of the outcome
      await Notification.create({
        userId: leaveUser._id,
        title: `Leave ${action}`,
        message: `Your leave request has been ${action}.${comment ? ' Comment: ' + comment : ''}`,
        type: action === 'approved' ? 'leave_approved' : 'leave_rejected',
        leaveId: leave._id,
      });

      const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
      try { await sendLeaveStatusEmail(leaveUser.email, action, dateStr, comment); } catch (_) {} // Email failure shouldn't break the response

      await createAuditLog(req.user!._id, action.toUpperCase(), 'Leave', `Leave ${action} for ${leaveUser.email}`, leave._id);
      res.json({ success: true, message: `Leave ${action} successfully`, leave });
      return;
    }

    // ── 2-LEVEL FLOW: Manager approves first, then Admin gives final decision ───────
    if (approvalLevels === 2) {

      // REJECTION — any manager or admin can reject at any pending stage
      if (action === 'rejected') {
        if (!['pending_manager', 'pending_admin'].includes(leave.status)) {
          res.status(400).json({ success: false, message: 'Leave cannot be rejected at this stage' }); return;
        }
        leave.status = 'rejected' as any;
        leave.reviewedBy = req.user!._id as any;
        leave.reviewedOn = new Date();
        leave.adminComment = comment;
        await leave.save();

        await Notification.create({
          userId: leaveUser._id,
          title: 'Leave Rejected',
          message: `Your leave has been rejected.${comment ? ' Reason: ' + comment : ''}`,
          type: 'leave_rejected',
          leaveId: leave._id,
        });

        const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
        try { await sendLeaveStatusEmail(leaveUser.email, 'rejected', dateStr, comment); } catch (_) {}
        await createAuditLog(req.user!._id, 'REJECTED', 'Leave', `Leave rejected for ${leaveUser.email}`, leave._id);
        res.json({ success: true, message: 'Leave rejected', leave });
        return;
      }

      // APPROVAL STEP 1: Manager moves leave from pending_manager → pending_admin
      if (leave.status === 'pending_manager') {
        if (reviewerRole === 'manager') {
          leave.status = 'pending_admin' as any;     // Escalate to admin for final sign-off
          leave.managerApprovedBy = req.user!._id as any;
          leave.managerApprovedOn = new Date();
          leave.managerComment = comment;
          await leave.save();

          // Alert all active admins that final approval is required
          const admins = await User.find({ role: 'admin', isActive: true });
          for (const admin of admins) {
            await Notification.create({
              userId: admin._id,
              title: '⏳ Final Approval Needed',
              message: `${leaveUser.firstName} ${leaveUser.lastName}'s leave was approved by manager. Your final approval is required.`,
              type: 'leave_applied',
              leaveId: leave._id,
            });
          }

          // Let the employee know their leave has passed the first stage
          await Notification.create({
            userId: leaveUser._id,
            title: '✅ Manager Approved — Awaiting Admin',
            message: 'Your leave was approved by your manager. Waiting for admin final approval.',
            type: 'leave_approved',
            leaveId: leave._id,
          });

          await createAuditLog(req.user!._id, 'APPROVED', 'Leave', `Manager Level-1 approved for ${leaveUser.email}`, leave._id);
          res.json({ success: true, message: 'Manager approved (Level 1). Leave is now awaiting admin final approval.', leave });
          return;
        }

        // Admin can bypass the manager step and fully approve directly from pending_manager
        if (reviewerRole === 'admin') {
          leave.status = 'approved' as any;
          leave.reviewedBy = req.user!._id as any;
          leave.reviewedOn = new Date();
          leave.adminComment = comment;
          await leave.save();

          // Deduct leave balance immediately on direct admin approval
          await User.findByIdAndUpdate(leave.userId, {
            $inc: {
              'leaveBalances.$[elem].used': leave.totalDays,
              'leaveBalances.$[elem].remaining': -leave.totalDays,
            },
          }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });

          await Notification.create({
            userId: leaveUser._id,
            title: 'Leave Approved ✅',
            message: `Your leave has been fully approved.${comment ? ' Comment: ' + comment : ''}`,
            type: 'leave_approved',
            leaveId: leave._id,
          });

          const dateStr = `${leave.startDate.toDateString()} - ${leave.endDate.toDateString()}`;
          try { await sendLeaveStatusEmail(leaveUser.email, 'approved', dateStr, comment); } catch (_) {}
          await createAuditLog(req.user!._id, 'APPROVED', 'Leave', `Admin direct approval for ${leaveUser.email}`, leave._id);
          res.json({ success: true, message: 'Leave fully approved', leave });
          return;
        }
      }

      // APPROVAL STEP 2: Admin gives the final decision on pending_admin leaves
      if (leave.status === 'pending_admin') {
        if (reviewerRole !== 'admin') {
          // Only admins can complete the second approval level
          res.status(403).json({ success: false, message: 'This leave is awaiting admin final approval. Only an admin can approve it now.' }); return;
        }

        leave.status = 'approved' as any;
        leave.reviewedBy = req.user!._id as any;
        leave.reviewedOn = new Date();
        leave.adminComment = comment;
        await leave.save();

        // Deduct leave balance after final admin approval
        await User.findByIdAndUpdate(leave.userId, {
          $inc: {
            'leaveBalances.$[elem].used': leave.totalDays,
            'leaveBalances.$[elem].remaining': -leave.totalDays,
          },
        }, { arrayFilters: [{ 'elem.leaveTypeId': leave.leaveTypeId }] });

        await Notification.create({
          userId: leaveUser._id,
          title: 'Leave Fully Approved ✅',
          message: `Your leave has been fully approved by admin.${comment ? ' Comment: ' + comment : ''}`,
          type: 'leave_approved',
          leaveId: leave._id,
        });

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