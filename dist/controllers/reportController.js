"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarData = exports.getDashboardStats = exports.getLeaveReport = void 0;
const Leave_1 = __importDefault(require("../models/Leave"));
const User_1 = __importDefault(require("../models/User"));
const LeaveType_1 = __importDefault(require("../models/LeaveType"));
const getLeaveReport = async (req, res) => {
    try {
        const { startDate, endDate, department, status } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (startDate && endDate)
            filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        if (department) {
            const users = await User_1.default.find({ department }).select('_id');
            filter.userId = { $in: users.map(u => u._id) };
        }
        const leaves = await Leave_1.default.find(filter).populate('userId', 'firstName lastName email department').populate('leaveTypeId', 'name color');
        const summary = {
            total: leaves.length,
            approved: leaves.filter(l => l.status === 'approved').length,
            rejected: leaves.filter(l => l.status === 'rejected').length,
            pending: leaves.filter(l => ['pending_manager', 'pending_admin'].includes(l.status)).length,
            totalDays: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + l.totalDays, 0),
        };
        const byDepartment = {};
        leaves.forEach(leave => {
            const dept = leave.userId.department;
            if (!byDepartment[dept])
                byDepartment[dept] = { count: 0, days: 0 };
            byDepartment[dept].count++;
            if (leave.status === 'approved')
                byDepartment[dept].days += leave.totalDays;
        });
        const byLeaveType = {};
        leaves.forEach(leave => {
            const typeName = leave.leaveTypeId.name;
            if (!byLeaveType[typeName])
                byLeaveType[typeName] = { count: 0, days: 0 };
            byLeaveType[typeName].count++;
            if (leave.status === 'approved')
                byLeaveType[typeName].days += leave.totalDays;
        });
        res.json({ success: true, leaves, summary, byDepartment, byLeaveType });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getLeaveReport = getLeaveReport;
const getDashboardStats = async (req, res) => {
    try {
        const isAdmin = ['admin', 'manager'].includes(req.user.role);
        const currentYear = new Date().getFullYear();
        if (isAdmin) {
            const [totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes] = await Promise.all([
                User_1.default.countDocuments({ isActive: true }),
                Leave_1.default.countDocuments({ status: { $in: ['pending_manager', 'pending_admin'] } }),
                Leave_1.default.countDocuments({ status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
                LeaveType_1.default.countDocuments({ isActive: true }),
            ]);
            const recentLeaves = await Leave_1.default.find({ status: { $in: ['pending_manager', 'pending_admin'] } }).populate('userId', 'firstName lastName department').populate('leaveTypeId', 'name color').sort({ createdAt: -1 }).limit(5);
            res.json({ success: true, stats: { totalUsers, pendingLeaves, approvedThisYear, totalLeaveTypes }, recentLeaves });
        }
        else {
            const userId = req.user._id;
            const [myPending, myApproved, myRejected] = await Promise.all([
                Leave_1.default.countDocuments({ userId, status: { $in: ['pending_manager', 'pending_admin'] } }),
                Leave_1.default.countDocuments({ userId, status: 'approved', startDate: { $gte: new Date(`${currentYear}-01-01`) } }),
                Leave_1.default.countDocuments({ userId, status: 'rejected' }),
            ]);
            const recentLeaves = await Leave_1.default.find({ userId }).populate('leaveTypeId', 'name color').sort({ createdAt: -1 }).limit(5);
            const user = await User_1.default.findById(userId).populate('leaveBalances.leaveTypeId', 'name color code');
            res.json({ success: true, stats: { myPending, myApproved, myRejected }, recentLeaves, leaveBalances: user?.leaveBalances });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDashboardStats = getDashboardStats;
const getCalendarData = async (req, res) => {
    try {
        const { year, month } = req.query;
        const start = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        const filter = { status: 'approved', startDate: { $lt: end }, endDate: { $gte: start } };
        const leaves = await Leave_1.default.find(filter).populate('userId', 'firstName lastName department').populate('leaveTypeId', 'name color');
        res.json({ success: true, leaves });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCalendarData = getCalendarData;
