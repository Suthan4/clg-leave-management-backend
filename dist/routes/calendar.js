"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Leave_1 = __importDefault(require("../models/Leave"));
const User_1 = __importDefault(require("../models/User"));
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/', async (req, res) => {
    try {
        const { month, year, department } = req.query;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        const filter = {
            status: 'approved',
            startDate: { $lte: end },
            endDate: { $gte: start },
        };
        if (department) {
            const users = await User_1.default.find({ department }).select('_id');
            filter.userId = { $in: users.map(u => u._id) };
        }
        else if (req.user.role === 'employee') {
            const user = await User_1.default.findById(req.user._id).select('department');
            const teammates = await User_1.default.find({ department: user?.department }).select('_id');
            filter.userId = { $in: teammates.map(u => u._id) };
        }
        const leaves = await Leave_1.default.find(filter)
            .populate('userId', 'name department')
            .populate('leaveTypeId', 'name color');
        res.json(leaves);
    }
    catch {
        res.status(500).json({ message: 'Failed to get calendar' });
    }
});
exports.default = router;
