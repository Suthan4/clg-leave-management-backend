"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = void 0;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const createAuditLog = async (userId, action, entity, details, entityId, ipAddress) => {
    try {
        await AuditLog_1.default.create({ userId, action, entity, entityId, details, ipAddress });
    }
    catch (error) {
        console.error('Audit log error:', error);
    }
};
exports.createAuditLog = createAuditLog;
