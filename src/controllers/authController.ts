import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import { sendVerificationCode } from '../utils/email';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';

// Helper: creates a signed JWT token for the given user ID
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d', // Token expires in 7 days by default
  } as jwt.SignOptions);
};

// Registers a new user account
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password, department, position, employeeId, phone, role } = req.body;

    // Prevent duplicate accounts by checking both email and employee ID
    const existingUser = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email or Employee ID already exists' });
      return;
    }

    // Create the user; default role is 'employee' unless explicitly provided
    const user = await User.create({ firstName, lastName, email, password, department, position, employeeId, phone, role: role || 'employee' });

    // Immediately issue a token so the user is logged in after registration
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: user._id, firstName, lastName, email, role: user.role, department, position },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
};

// Authenticates a user with email and password, returns a JWT token
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Both fields are required to proceed
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }

    // Look up the user and verify their password using bcrypt comparison
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    // Prevent login for deactivated accounts
    if (!user.isActive) {
      res.status(401).json({ success: false, message: 'Account is deactivated' });
      return;
    }

    const token = generateToken(user._id.toString());

    // Record a LOGIN event in the audit trail with the requester's IP
    await createAuditLog(user._id, 'LOGIN', 'Auth', `User ${user.email} logged in`, undefined, req.ip);

    res.json({
      success: true,
      token,
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, department: user.department,
        position: user.position, avatar: user.avatar,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
};

// Sends a 6-digit verification code to the user's email for password reset
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Do not reveal whether the email exists — but here we return 404 explicitly
    if (!user) {
      res.status(404).json({ success: false, message: 'No account with that email' });
      return;
    }

    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // Valid for 15 minutes
    await user.save({ validateBeforeSave: false }); // Skip full validation — only updating reset fields

    await sendVerificationCode(user.email, code);
    res.json({ success: true, message: 'Verification code sent to email' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to send verification code' });
  }
};

// Verifies the 6-digit code and returns a short-lived reset token
export const verifyCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;

    // Find user where code matches and hasn't expired yet
    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: Date.now() }, // Ensure the code is still valid
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired code' });
      return;
    }

    // Generate a secure random reset token and store it hashed on the user
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // Token valid for 10 minutes

    // Clear the verification code now that it's been used
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, resetToken });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// Resets the user's password using a valid reset token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetToken, newPassword } = req.body;

    // Find the user by token and check it hasn't expired
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    // Update the password — the pre-save hook in User model will hash it
    user.password = newPassword;
    user.resetPasswordToken = undefined; // Invalidate the token after use
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// Returns the currently authenticated user's profile data
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!; // User is guaranteed to exist here due to the `protect` middleware
  res.json({
    success: true,
    user: {
      id: user._id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, role: user.role, department: user.department,
      position: user.position, phone: user.phone, avatar: user.avatar,
      employeeId: user.employeeId, leaveBalances: user.leaveBalances,
    },
  });
};

// Allows an authenticated user to change their own password
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Re-fetch with password field (normally excluded by default select)
    const user = await User.findById(req.user!._id);

    // Verify the current password is correct before allowing the change
    if (!user || !(await user.comparePassword(currentPassword))) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword; // Pre-save hook will hash the new password
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Password change failed' });
  }
};