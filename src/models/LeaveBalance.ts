import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaveBalance extends Document {
  userId: mongoose.Types.ObjectId;
  leaveTypeId: mongoose.Types.ObjectId;
  year: number;
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

const LeaveBalanceSchema = new Schema<ILeaveBalance>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year: { type: Number, required: true },
  total: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
}, { timestamps: true });

LeaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

export default mongoose.model<ILeaveBalance>('LeaveBalance', LeaveBalanceSchema);
