import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.user!._id, isRead: false });
    res.json({ success: true, notifications, unreadCount });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany({ userId: req.user!._id, isRead: false }, { isRead: true });
    } else {
      await Notification.findOneAndUpdate({ _id: id, userId: req.user!._id }, { isRead: true });
    }
    res.json({ success: true, message: 'Marked as read' });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
