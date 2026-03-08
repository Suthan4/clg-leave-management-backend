"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Organization_1 = __importDefault(require("../models/Organization"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/', async (_req, res) => {
    try {
        let org = await Organization_1.default.findOne();
        if (!org)
            org = await Organization_1.default.create({ name: 'My Organization' });
        res.json(org);
    }
    catch {
        res.status(500).json({ message: 'Failed to get organization' });
    }
});
router.put('/', auth_1.adminOnly, async (req, res) => {
    try {
        let org = await Organization_1.default.findOne();
        if (!org) {
            org = await Organization_1.default.create(req.body);
        }
        else {
            Object.assign(org, req.body);
            await org.save();
        }
        res.json(org);
    }
    catch {
        res.status(500).json({ message: 'Failed to update organization' });
    }
});
exports.default = router;
