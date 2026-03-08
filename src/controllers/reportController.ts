import { Response } from 'express';
import Leave from '../models/Leave';
import User from '../models/User';
import LeaveType from '../models/LeaveType';
import { AuthRequest } from '../middleware/auth';

// Generates a leave report with summary stats, department breakdown, and leave-type breakdown
export const getLeaveReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department, status } = req.query;
    const filter: any = {};

    if (status) filter.status = status;

    // Apply date range filter if both boundaries are provided
    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    // Resolve department filter to a set of user IDs
    if (department) {
      const users = await User.find({ department }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }

    const leaves = await Leave.find(filter)
      .populate('userId', 'firstName lastName email department')
      .populate('leaveTypeId', 'name color');

    // High-level summary counts and total approved days
    const summary = {
      total:     leaves.length,
      approved:  leaves.filter(l => l.status === 'approved').length,
      rejected:  leaves.filter(l => l.status === 'rejected').length,
      pending:   leaves.filter(l => ['pending_manager', 'pending_admin'].includes(l.status)).length,
      totalDays: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + l.totalDays, 0),
    };

    // Aggregate leave counts and approved days grouped by department
    const byDepartment: any = {};
    leaves.forEach(leave => {
      const dept = (leave.userId as any).department;
      if (!byDepartment[dept]) byDepartment[dept] = { count: 0, days: 0 };
      byDepartment[dept].count++;
      if (leave.status === 'approved') byDepartment[dept].days += leave.totalDays;
    });

    // Aggregate leave counts and approved days grouped by leave type name
    const byLeaveType: any = {};
    leaves.forEach(leave => {
      const typeName = (leave.leaveTypeId as any).name;
      if (!byLeaveType[typeName]) byLeaveType[typeName] = { count: 0, days: 0 };
      byLeaveType[typeName].count++;
      if (leave.status === 'approved') byLeaveType[typeName].days += leave.totalDays;
    });

    res.json({ success: true, leaves, summary, byDepartment, byLeaveType });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns dashboard statistics — different data depending on whether the user is an admin/manager or employee
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = ['admin', 'manager'].includes(req.user!.role);
    const currentYear = new Date().getFullYear();

    if (isAdmin) {
      // Admin/manager dashboard: organisation-wide metrics
      const [totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes] = await Promise.all([
        User.countDocuments({ isActive: true }),
        Leave.countDocuments({ status: { $in: ['pending_manager', 'pending_admin'] } }),
        Leave.countDocuments({ status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
        LeaveType.countDocuments({ isActive: true }),
      ]);

      // Latest pending leaves for the quick-action list on the admin dashboard
      const recentLeaves = await Leave.find({ status: { $in: ['pending_manager', 'pending_admin'] } })
        .populate('userId', 'firstName lastName department')
        .populate('leaveTypeId', 'name color')
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({ success: true, stats: { totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes }, recentLeaves });
    } else {
      // Employee dashboard: personal leave metrics for the current year
      const userId = req.user!._id;

      const [myPending, myApproved, myRejected] = await Promise.all([
        Leave.countDocuments({ userId, status: { $in: ['pending_manager', 'pending_admin'] } }),
        Leave.countDocuments({ userId, status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
        Leave.countDocuments({ userId, status: 'rejected' }),
      ]);

      const recentLeaves = await Leave.find({ userId })
        .populate('leaveTypeId', 'name color')
        .sort({ createdAt: -1 })
        .limit(5);

      // Include leave balances so the employee can see their remaining entitlements
      const user = await User.findById(userId).populate('leaveBalances.leaveTypeId', 'name color code');

      res.json({ success: true, stats: { myPending, myApproved, myRejected }, recentLeaves, leaveBalances: user?.leaveBalances });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns approved leaves that overlap with a given calendar month (for calendar display)
export const getCalendarData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year, month } = req.query;

    // Build the start/end window for the requested month
    const start = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1); // First day of the next month

    // Find any approved leave that overlaps with this month's window
    const filter: any = {
      status: 'approved',
      startDate: { $lt: end },  // Leave starts before the month ends
      endDate:   { $gte: start }, // Leave ends on or after the month starts
    };

    const leaves = await Leave.find(filter)
      .populate('userId', 'firstName lastName department')
      .populate('leaveTypeId', 'name color');

    res.json({ success: true, leaves });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};