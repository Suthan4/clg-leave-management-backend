"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, entity } = req.query;
        const filter = {};
        if (entity)
            filter.entity = entity;
        const total = await AuditLog_1.default.countDocuments(filter);
        const logs = await AuditLog_1.default.find(filter).populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
        res.json({ success: true, logs, total, page: +page, totalPages: Math.ceil(total / +limit) });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAuditLogs = getAuditLogs;
