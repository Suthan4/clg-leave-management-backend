import { Response } from 'express';
import User from '../models/User';
import LeaveType from '../models/LeaveType';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

// Strips optional ObjectId reference fields if they are empty strings/null/undefined
// to prevent Mongoose from attempting to cast "" as a BSONError ObjectId
const sanitiseBody = (body: any) => {
  const d = { ...body };
  for (const field of ['managerId', 'departmentId', 'teamId']) {
    if (d[field] === '' || d[field] === null || d[field] === undefined) delete d[field];
  }
  if (d.phone === '') delete d.phone; // Also strip empty phone to avoid storing blank strings
  return d;
};

// Returns a paginated, filterable list of all users — admin only
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, department, role, isActive, page = 1, limit = 20 } = req.query;
    const filter: any = {};

    // Case-insensitive partial match across first name, last name, and email
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search as string, 'i') },
        { lastName:  new RegExp(search as string, 'i') },
        { email:     new RegExp(search as string, 'i') },
      ];
    }

    if (department) filter.department = department;
    if (role)       filter.role       = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true'; // Convert string to boolean

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')                           // Never expose password hashes
      .populate('managerId', 'firstName lastName')   // Show manager name for display
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, users, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns a single user's full profile including their manager and leave balances
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('managerId', 'firstName lastName email')
      .populate('leaveBalances.leaveTypeId', 'name color code'); // Enrich balances with type metadata

    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Creates a new user and automatically initialises their leave balances from active leave types
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Prevent duplicate accounts on both email and employee ID
    const existing = await User.findOne({ $or: [{ email: req.body.email }, { employeeId: req.body.employeeId }] });
    if (existing) { res.status(400).json({ success: false, message: 'Email or Employee ID exists' }); return; }

    // Seed leave balances for every active leave type so the user has allocations from day one
    const leaveTypes = await LeaveType.find({ isActive: true });
    const leaveBalances = leaveTypes.map(lt => ({
      leaveTypeId: lt._id,
      allocated:   lt.defaultDays,
      used:        0,
      remaining:   lt.defaultDays,
    }));

    const user = await User.create({ ...sanitiseBody(req.body), leaveBalances });
    await createAuditLog(req.user!._id, 'CREATE', 'User', `Created user ${req.body.email}`, user._id);

    // Return user data without the password hash
    res.status(201).json({ success: true, message: 'User created', user: { ...user.toObject(), password: undefined } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Updates an existing user's profile fields — password changes must go through changePassword
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, ...rest } = req.body; // Exclude password to prevent unintended plain-text storage
    const updateData = sanitiseBody(rest);

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,           // Return the updated document
      runValidators: true, // Enforce schema validation on the update
    }).select('-password');

    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    await createAuditLog(req.user!._id, 'UPDATE', 'User', `Updated user ${user.email}`, user._id);
    res.json({ success: true, message: 'User updated', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Soft-deletes a user by deactivating them — prevents deletion of admin accounts
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    // Protect admin accounts from accidental deletion
    if (user.role === 'admin') {
      res.status(400).json({ success: false, message: 'Cannot delete admin users' }); return;
    }

    // Soft delete — keeps the record for historical audit purposes
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    await createAuditLog(req.user!._id, 'DELETE', 'User', `Deactivated user ${user.email}`, user._id);
    res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Allows an authenticated user to update their own profile; handles optional avatar upload
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, department, position } = req.body;
    const avatar = (req.file as Express.Multer.File)?.path; // Path set by multer if a file was uploaded

    const updateData: any = { firstName, lastName, phone, department, position };
    if (avatar) updateData.avatar = avatar; // Only overwrite avatar if a new file was uploaded

    const user = await User.findByIdAndUpdate(req.user!._id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns a distinct list of department names — used to populate filter dropdowns
export const getDepartments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departments = await User.distinct('department'); // Deduplicates department values automatically
    res.json({ success: true, departments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};