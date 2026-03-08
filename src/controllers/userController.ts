import { Response } from 'express';
import User from '../models/User';
import LeaveType from '../models/LeaveType';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const sanitiseBody = (body: any) => {
  const d = { ...body };
  for (const field of ['managerId', 'departmentId', 'teamId']) {
    if (d[field] === '' || d[field] === null || d[field] === undefined) delete d[field];
  }
  if (d.phone === '') delete d.phone;
  return d;
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, department, role, isActive, page = 1, limit = 20 } = req.query;
    const filter: any = {};
    if (search) filter.$or = [{ firstName: new RegExp(search as string, 'i') }, { lastName: new RegExp(search as string, 'i') }, { email: new RegExp(search as string, 'i') }];
    if (department) filter.department = department;
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).select('-password').populate('managerId', 'firstName lastName').sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
    res.json({ success: true, users, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('managerId', 'firstName lastName email').populate('leaveBalances.leaveTypeId', 'name color code');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await User.findOne({ $or: [{ email: req.body.email }, { employeeId: req.body.employeeId }] });
    if (existing) { res.status(400).json({ success: false, message: 'Email or Employee ID exists' }); return; }

    const leaveTypes = await LeaveType.find({ isActive: true });
    const leaveBalances = leaveTypes.map(lt => ({ leaveTypeId: lt._id, allocated: lt.defaultDays, used: 0, remaining: lt.defaultDays }));
    // sanitiseBody removes managerId:"" which causes BSONError
    const user = await User.create({ ...sanitiseBody(req.body), leaveBalances });
    await createAuditLog(req.user!._id, 'CREATE', 'User', `Created user ${req.body.email}`, user._id);
    res.status(201).json({ success: true, message: 'User created', user: { ...user.toObject(), password: undefined } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, ...rest } = req.body;
    const updateData = sanitiseBody(rest);
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    await createAuditLog(req.user!._id, 'UPDATE', 'User', `Updated user ${user.email}`, user._id);
    res.json({ success: true, message: 'User updated', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    if (user.role === 'admin') { res.status(400).json({ success: false, message: 'Cannot delete admin users' }); return; }

    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    await createAuditLog(req.user!._id, 'DELETE', 'User', `Deactivated user ${user.email}`, user._id);
    res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, department, position } = req.body;
    const avatar = (req.file as Express.Multer.File)?.path;
    const updateData: any = { firstName, lastName, phone, department, position };
    if (avatar) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user!._id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDepartments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departments = await User.distinct('department');
    res.json({ success: true, departments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
