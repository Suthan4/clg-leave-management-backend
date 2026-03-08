"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotifications = void 0;
const Notification_1 = __importDefault(require("../models/Notification"));
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification_1.default.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification_1.default.countDocuments({ userId: req.user._id, isRead: false });
        res.json({ success: true, notifications, unreadCount });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        if (id === 'all') {
            await Notification_1.default.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
        }
        else {
            await Notification_1.default.findOneAndUpdate({ _id: id, userId: req.user._id }, { isRead: true });
        }
        res.json({ success: true, message: 'Marked as read' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markAsRead = markAsRead;
