"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartments = exports.updateProfile = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const User_1 = __importDefault(require("../models/User"));
const LeaveType_1 = __importDefault(require("../models/LeaveType"));
const audit_1 = require("../utils/audit");
const getAllUsers = async (req, res) => {
    try {
        const { search, department, role, isActive, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (search)
            filter.$or = [{ firstName: new RegExp(search, 'i') }, { lastName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
        if (department)
            filter.department = department;
        if (role)
            filter.role = role;
        if (isActive !== undefined)
            filter.isActive = isActive === 'true';
        const total = await User_1.default.countDocuments(filter);
        const users = await User_1.default.find(filter).select('-password').populate('managerId', 'firstName lastName').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
        res.json({ success: true, users, total, page: +page, totalPages: Math.ceil(total / +limit) });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select('-password').populate('managerId', 'firstName lastName email').populate('leaveBalances.leaveTypeId', 'name color code');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserById = getUserById;
const createUser = async (req, res) => {
    try {
        const existing = await User_1.default.findOne({ $or: [{ email: req.body.email }, { employeeId: req.body.employeeId }] });
        if (existing) {
            res.status(400).json({ success: false, message: 'Email or Employee ID exists' });
            return;
        }
        const leaveTypes = await LeaveType_1.default.find({ isActive: true });
        const leaveBalances = leaveTypes.map(lt => ({ leaveTypeId: lt._id, allocated: lt.defaultDays, used: 0, remaining: lt.defaultDays }));
        const user = await User_1.default.create({ ...req.body, leaveBalances });
        await (0, audit_1.createAuditLog)(req.user._id, 'CREATE', 'User', `Created user ${req.body.email}`, user._id);
        res.status(201).json({ success: true, message: 'User created', user: { ...user.toObject(), password: undefined } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { password, ...updateData } = req.body;
        const user = await User_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        await (0, audit_1.createAuditLog)(req.user._id, 'UPDATE', 'User', `Updated user ${user.email}`, user._id);
        res.json({ success: true, message: 'User updated', user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (user.role === 'admin') {
            res.status(400).json({ success: false, message: 'Cannot delete admin users' });
            return;
        }
        await User_1.default.findByIdAndUpdate(req.params.id, { isActive: false });
        await (0, audit_1.createAuditLog)(req.user._id, 'DELETE', 'User', `Deactivated user ${user.email}`, user._id);
        res.json({ success: true, message: 'User deactivated' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteUser = deleteUser;
const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, department, position } = req.body;
        const avatar = req.file?.path;
        const updateData = { firstName, lastName, phone, department, position };
        if (avatar)
            updateData.avatar = avatar;
        const user = await User_1.default.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');
        res.json({ success: true, message: 'Profile updated', user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateProfile = updateProfile;
const getDepartments = async (_req, res) => {
    try {
        const departments = await User_1.default.distinct('department');
        res.json({ success: true, departments });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDepartments = getDepartments;
