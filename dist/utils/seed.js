"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = __importDefault(require("../models/User"));
const LeaveType_1 = __importDefault(require("../models/LeaveType"));
const Settings_1 = __importDefault(require("../models/Settings"));
dotenv_1.default.config();
const seed = async () => {
    const uri = process.env.MONGODB_URI || '';
    await mongoose_1.default.connect(uri);
    console.log('Connected to MongoDB');
    // Leave Types
    const leaveTypes = await LeaveType_1.default.insertMany([
        { name: 'Annual Leave', code: 'AL', description: 'General annual vacation leave', defaultDays: 18, color: '#2563eb', requiresDocument: false, minNoticeDays: 3, maxConsecutiveDays: 15, carryForward: true, maxCarryForwardDays: 5 },
        { name: 'Sick Leave', code: 'SL', description: 'Leave due to illness or medical reasons', defaultDays: 12, color: '#dc2626', requiresDocument: true, minNoticeDays: 0, maxConsecutiveDays: 10, carryForward: false },
        { name: 'Casual Leave', code: 'CL', description: 'Short-notice personal leave', defaultDays: 6, color: '#16a34a', requiresDocument: false, minNoticeDays: 1, maxConsecutiveDays: 3, carryForward: false },
        { name: 'Maternity Leave', code: 'ML', description: 'Leave for maternity purposes', defaultDays: 90, color: '#9333ea', requiresDocument: true, minNoticeDays: 30, maxConsecutiveDays: 90, carryForward: false, applicableFor: 'female' },
        { name: 'Paternity Leave', code: 'PL', description: 'Leave for paternity purposes', defaultDays: 10, color: '#0ea5e9', requiresDocument: false, minNoticeDays: 7, maxConsecutiveDays: 10, carryForward: false, applicableFor: 'male' },
    ]);
    console.log('✅ Leave types created');
    const makeBalances = () => leaveTypes.map(lt => ({ leaveTypeId: lt._id, allocated: lt.defaultDays, used: 0, remaining: lt.defaultDays }));
    // Admin user
    const adminExists = await User_1.default.findOne({ email: 'admin@company.com' });
    if (!adminExists) {
        await User_1.default.create({ firstName: 'Admin', lastName: 'User', email: 'admin@company.com', password: 'admin123', role: 'admin', department: 'Administration', position: 'System Administrator', employeeId: 'EMP001', leaveBalances: makeBalances() });
        console.log('✅ Admin created: admin@company.com / admin123');
    }
    // Manager user
    const managerExists = await User_1.default.findOne({ email: 'manager@company.com' });
    if (!managerExists) {
        await User_1.default.create({ firstName: 'Priya', lastName: 'Sharma', email: 'manager@company.com', password: 'manager123', role: 'manager', department: 'Engineering', position: 'Engineering Manager', employeeId: 'EMP002', leaveBalances: makeBalances() });
        console.log('✅ Manager created: manager@company.com / manager123');
    }
    // Employee users
    const employees = [
        { firstName: 'Rajan', lastName: 'Kumar', email: 'rajan@company.com', department: 'Engineering', position: 'Senior Developer', employeeId: 'EMP003' },
        { firstName: 'Anita', lastName: 'Patel', email: 'anita@company.com', department: 'HR', position: 'HR Executive', employeeId: 'EMP004' },
        { firstName: 'Vikram', lastName: 'Singh', email: 'vikram@company.com', department: 'Finance', position: 'Finance Analyst', employeeId: 'EMP005' },
        { firstName: 'Deepa', lastName: 'Nair', email: 'deepa@company.com', department: 'Engineering', position: 'QA Engineer', employeeId: 'EMP006' },
    ];
    for (const emp of employees) {
        const exists = await User_1.default.findOne({ email: emp.email });
        if (!exists)
            await User_1.default.create({ ...emp, password: 'emp123', role: 'employee', leaveBalances: makeBalances() });
    }
    console.log('✅ Employees created (password: emp123)');
    // Settings
    await Settings_1.default.findOneAndUpdate({}, { orgName: 'TechCorp India Pvt Ltd', workDays: [1, 2, 3, 4, 5], fiscalYearStart: 4, timezone: 'Asia/Kolkata', leaveApprovalLevels: 1,
        holidays: [
            { date: new Date('2025-01-26'), name: 'Republic Day' },
            { date: new Date('2025-08-15'), name: 'Independence Day' },
            { date: new Date('2025-10-02'), name: 'Gandhi Jayanti' },
            { date: new Date('2025-12-25'), name: 'Christmas' },
        ]
    }, { upsert: true });
    console.log('✅ Settings configured');
    console.log('\n🎉 Seed complete! You can now login with:');
    console.log('   Admin:    admin@company.com    / admin123');
    console.log('   Manager:  manager@company.com  / manager123');
    console.log('   Employee: rajan@company.com    / emp123');
    await mongoose_1.default.disconnect();
};
seed().catch(e => { console.error(e); process.exit(1); });
