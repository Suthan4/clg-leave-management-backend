import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaveType extends Document {
  name: string;
  code: string;
  description: string;
  defaultDays: number;
  color: string;
  requiresDocument: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number;
  carryForward: boolean;
  maxCarryForwardDays: number;
  isActive: boolean;
  applicableFor: 'all' | 'male' | 'female';
}

const LeaveTypeSchema = new Schema<ILeaveType>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true,trim: true  },
  description: { type: String, default: '' },
  defaultDays: { type: Number, required: true, min: 0 },
  color: { type: String, default: '#3B82F6' },
  requiresDocument: { type: Boolean, default: false },
  minNoticeDays: { type: Number, default: 0 },
  maxConsecutiveDays: { type: Number, default: 30 },
  carryForward: { type: Boolean, default: false },
  maxCarryForwardDays: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  applicableFor: { type: String, enum: ['all', 'male', 'female'], default: 'all' },
}, { timestamps: true });

export default mongoose.model<ILeaveType>('LeaveType', LeaveTypeSchema);
