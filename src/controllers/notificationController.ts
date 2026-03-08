import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

// Fetches the latest 50 notifications for the logged-in user along with the unread count
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!._id })
      .sort({ createdAt: -1 }) // Newest notifications first
      .limit(50);              // Cap at 50 to avoid large payloads

    // Separate query to get the unread count for the notification badge
    const unreadCount = await Notification.countDocuments({ userId: req.user!._id, isRead: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Marks one or all notifications as read for the current user
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === 'all') {
      // Bulk update — mark every unread notification for this user as read
      await Notification.updateMany({ userId: req.user!._id, isRead: false }, { isRead: true });
    } else {
      // Single update — scoped to userId to prevent users marking others' notifications
      await Notification.findOneAndUpdate({ _id: id, userId: req.user!._id }, { isRead: true });
    }

    res.json({ success: true, message: 'Marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};