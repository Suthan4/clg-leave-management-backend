import { Request, Response } from 'express';
import LeaveType from '../models/LeaveType';
import { AuthRequest } from '../middleware/auth';

// Returns only active leave types — used by employees when applying for leave
export const getLeaveTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = await LeaveType.find({ isActive: true }).sort({ name: 1 }); // Alphabetical order
    res.json({ success: true, leaveTypes: types });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns all leave types including inactive ones — for admin management views
export const getAllLeaveTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = await LeaveType.find().sort({ name: 1 });
    res.json({ success: true, leaveTypes: types });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Creates a new leave type; enforces unique uppercase codes
export const createLeaveType = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.body.code?.toUpperCase(); // Normalise code to uppercase before checking duplicates

    const existing = await LeaveType.findOne({ code });
    if (existing) {
      res.status(400).json({ success: false, message: 'Code already exists' }); return;
    }

    const lt = await LeaveType.create(req.body);
    res.status(201).json({ success: true, leaveType: lt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Updates an existing leave type by ID, running schema validators on the new values
export const updateLeaveType = async (req: Request, res: Response): Promise<void> => {
  try {
    const lt = await LeaveType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // Return updated document and enforce schema rules
    );
    if (!lt) { res.status(404).json({ success: false, message: 'Leave type not found' }); return; }
    res.json({ success: true, leaveType: lt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Soft-deletes a leave type by marking it inactive (preserves historical leave records)
export const deleteLeaveType = async (req: Request, res: Response): Promise<void> => {
  try {
    await LeaveType.findByIdAndUpdate(req.params.id, { isActive: false }); // Soft delete — keeps data intact
    res.json({ success: true, message: 'Leave type deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};