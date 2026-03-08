import { Response } from 'express';
import Leave from '../models/Leave';
import User from '../models/User';
import LeaveType from '../models/LeaveType';
import { AuthRequest } from '../middleware/auth';

export const getLeaveReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department, status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (startDate && endDate) filter.startDate = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };

    if (department) {
      const users = await User.find({ department }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }

    const leaves = await Leave.find(filter).populate('userId', 'firstName lastName email department').populate('leaveTypeId', 'name color');

    const summary = {
      total: leaves.length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
      pending: leaves.filter(l => ['pending_manager','pending_admin'].includes(l.status)).length,
      totalDays: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + l.totalDays, 0),
    };

    const byDepartment: any = {};
    leaves.forEach(leave => {
      const dept = (leave.userId as any).department;
      if (!byDepartment[dept]) byDepartment[dept] = { count: 0, days: 0 };
      byDepartment[dept].count++;
      if (leave.status === 'approved') byDepartment[dept].days += leave.totalDays;
    });

    const byLeaveType: any = {};
    leaves.forEach(leave => {
      const typeName = (leave.leaveTypeId as any).name;
      if (!byLeaveType[typeName]) byLeaveType[typeName] = { count: 0, days: 0 };
      byLeaveType[typeName].count++;
      if (leave.status === 'approved') byLeaveType[typeName].days += leave.totalDays;
    });

    res.json({ success: true, leaves, summary, byDepartment, byLeaveType });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = ['admin', 'manager'].includes(req.user!.role);
    const currentYear = new Date().getFullYear();

    if (isAdmin) {
      const [totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes] = await Promise.all([
        User.countDocuments({ isActive: true }),
        Leave.countDocuments({ status: { $in: ['pending_manager','pending_admin'] } }),
        Leave.countDocuments({ status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
        LeaveType.countDocuments({ isActive: true }),
      ]);

      const recentLeaves = await Leave.find({ status: { $in: ['pending_manager','pending_admin'] } }).populate('userId', 'firstName lastName department').populate('leaveTypeId', 'name color').sort({ createdAt: -1 }).limit(5);

      res.json({ success: true, stats: { totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes }, recentLeaves });
    } else {
      const userId = req.user!._id;
      const [myPending, myApproved, myRejected] = await Promise.all([
        Leave.countDocuments({ userId, status: { $in: ['pending_manager','pending_admin'] } }),
        Leave.countDocuments({ userId, status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
        Leave.countDocuments({ userId, status: 'rejected' }),
      ]);

      const recentLeaves = await Leave.find({ userId }).populate('leaveTypeId', 'name color').sort({ createdAt: -1 }).limit(5);
      const user = await User.findById(userId).populate('leaveBalances.leaveTypeId', 'name color code');

      res.json({ success: true, stats: { myPending, myApproved, myRejected }, recentLeaves, leaveBalances: user?.leaveBalances });
    }
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getCalendarData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year, month } = req.query;
    const start = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const filter: any = { status: 'approved', startDate: { $lt: end }, endDate: { $gte: start } };

    const leaves = await Leave.find(filter).populate('userId', 'firstName lastName department').populate('leaveTypeId', 'name color');
    res.json({ success: true, leaves });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
