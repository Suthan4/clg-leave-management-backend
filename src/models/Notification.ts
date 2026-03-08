import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'leave_applied' | 'leave_approved' | 'leave_rejected' | 'leave_cancelled' | 'system';
  isRead: boolean;
  leaveId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['leave_applied', 'leave_approved', 'leave_rejected', 'leave_cancelled', 'system'], required: true },
  isRead: { type: Boolean, default: false },
  leaveId: { type: Schema.Types.ObjectId, ref: 'Leave' },
}, { timestamps: true });

export default mongoose.model<INotification>('Notification', NotificationSchema);
