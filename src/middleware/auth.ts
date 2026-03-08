import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// Extends the Express Request type to carry the authenticated user on req.user
export interface AuthRequest extends Request {
  user?: IUser;
}

// Middleware: verifies the JWT from the Authorization header and attaches the user to the request
export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract the token from the "Bearer <token>" header format
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized, no token' });
      return;
    }

    // Verify signature and expiry; throws if invalid
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

    // Re-fetch the user to ensure they still exist and are active (catches deactivated accounts)
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User not found or inactive' });
      return;
    }

    req.user = user; // Attach to request so downstream handlers can access it
    next();
  } catch {
    // Catches both jwt.JsonWebTokenError (bad signature) and jwt.TokenExpiredError
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Middleware: restricts access to admin-role users only
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};

// Middleware: allows access to both managers and admins (e.g., leave review, reports)
export const managerOrAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!['admin', 'manager'].includes(req.user?.role || '')) {
    res.status(403).json({ success: false, message: 'Manager or Admin access required' });
    return;
  }
  next();
};