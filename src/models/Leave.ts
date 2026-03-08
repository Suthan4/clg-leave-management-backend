import mongoose, { Document, Schema } from 'mongoose';

export type LeaveStatus = 'pending_manager' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled'


export interface ILeave extends Document {
  userId: mongoose.Types.ObjectId;
  leaveTypeId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  attachments: string[];
  appliedOn: Date;
  // Level 1 — Manager approval
  managerApprovedBy?: mongoose.Types.ObjectId;
  managerApprovedOn?: Date;
  managerComment?: string;
  // Level 2 — Admin approval (final)
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedOn?: Date;
  adminComment?: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
}

const LeaveSchema = new Schema<ILeave>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true, min: 0.5 },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending_manager','pending_admin','approved','rejected','cancelled'], default: 'pending_manager' },
  attachments: [{ type: String }],
  appliedOn: { type: Date, default: Date.now },
  // Level 1
  managerApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  managerApprovedOn: Date,
  managerComment: String,
  // Level 2 (final)
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedOn: Date,
  adminComment: String,
  isHalfDay: { type: Boolean, default: false },
  halfDayPeriod: { type: String, enum: ['morning', 'afternoon'] },
}, { timestamps: true });

export default mongoose.model<ILeave>('Leave', LeaveSchema);