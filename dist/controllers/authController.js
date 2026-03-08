"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.getMe = exports.resetPassword = exports.verifyCode = exports.forgotPassword = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = __importDefault(require("../models/User"));
const email_1 = require("../utils/email");
const audit_1 = require("../utils/audit");
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};
const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, department, position, employeeId, phone, role } = req.body;
        const existingUser = await User_1.default.findOne({ $or: [{ email }, { employeeId }] });
        if (existingUser) {
            res.status(400).json({ success: false, message: 'Email or Employee ID already exists' });
            return;
        }
        const user = await User_1.default.create({ firstName, lastName, email, password, department, position, employeeId, phone, role: role || 'employee' });
        const token = generateToken(user._id.toString());
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: { id: user._id, firstName, lastName, email, role: user.role, department, position },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Registration failed' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email and password required' });
            return;
        }
        const user = await User_1.default.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
            return;
        }
        if (!user.isActive) {
            res.status(401).json({ success: false, message: 'Account is deactivated' });
            return;
        }
        const token = generateToken(user._id.toString());
        await (0, audit_1.createAuditLog)(user._id, 'LOGIN', 'Auth', `User ${user.email} logged in`, undefined, req.ip);
        res.json({
            success: true,
            token,
            user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, department: user.department, position: user.position, avatar: user.avatar },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Login failed' });
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(404).json({ success: false, message: 'No account with that email' });
            return;
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        await (0, email_1.sendVerificationCode)(user.email, code);
        res.json({ success: true, message: 'Verification code sent to email' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send verification code' });
    }
};
exports.forgotPassword = forgotPassword;
const verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        const user = await User_1.default.findOne({
            email,
            verificationCode: code,
            verificationCodeExpires: { $gt: Date.now() },
        });
        if (!user) {
            res.status(400).json({ success: false, message: 'Invalid or expired code' });
            return;
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, resetToken });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
};
exports.verifyCode = verifyCode;
const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        const user = await User_1.default.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
            return;
        }
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.json({ success: true, message: 'Password reset successful' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Password reset failed' });
    }
};
exports.resetPassword = resetPassword;
const getMe = async (req, res) => {
    const user = req.user;
    res.json({ success: true, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, department: user.department, position: user.position, phone: user.phone, avatar: user.avatar, employeeId: user.employeeId, leaveBalances: user.leaveBalances } });
};
exports.getMe = getMe;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User_1.default.findById(req.user._id);
        if (!user || !(await user.comparePassword(currentPassword))) {
            res.status(400).json({ success: false, message: 'Current password is incorrect' });
            return;
        }
        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Password change failed' });
    }
};
exports.changePassword = changePassword;
