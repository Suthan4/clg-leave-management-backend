"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeaveType = exports.updateLeaveType = exports.createLeaveType = exports.getAllLeaveTypes = exports.getLeaveTypes = void 0;
const LeaveType_1 = __importDefault(require("../models/LeaveType"));
const getLeaveTypes = async (_req, res) => {
    try {
        const types = await LeaveType_1.default.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, leaveTypes: types });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getLeaveTypes = getLeaveTypes;
const getAllLeaveTypes = async (_req, res) => {
    try {
        const types = await LeaveType_1.default.find().sort({ name: 1 });
        res.json({ success: true, leaveTypes: types });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllLeaveTypes = getAllLeaveTypes;
const createLeaveType = async (req, res) => {
    try {
        const code = req.body.code?.toUpperCase();
        const existing = await LeaveType_1.default.findOne({ code });
        if (existing) {
            res.status(400).json({ success: false, message: 'Code already exists' });
            return;
        }
        const lt = await LeaveType_1.default.create(req.body);
        res.status(201).json({ success: true, leaveType: lt });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createLeaveType = createLeaveType;
const updateLeaveType = async (req, res) => {
    try {
        const lt = await LeaveType_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!lt) {
            res.status(404).json({ success: false, message: 'Leave type not found' });
            return;
        }
        res.json({ success: true, leaveType: lt });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateLeaveType = updateLeaveType;
const deleteLeaveType = async (req, res) => {
    try {
        await LeaveType_1.default.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ success: true, message: 'Leave type deactivated' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteLeaveType = deleteLeaveType;
