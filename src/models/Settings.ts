import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  orgName: string;
  orgLogo?: string;
  workDays: number[];
  holidays: { date: Date; name: string }[];
  fiscalYearStart: number;
  timezone: string;
  leaveApprovalLevels: number;
  autoApproveAfterDays: number;
}

const SettingsSchema = new Schema<ISettings>({
  orgName: { type: String, default: 'My Organization' },
  orgLogo: String,
  workDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  holidays: [{
    date: { type: Date, required: true },
    name: { type: String, required: true }
  }],
  fiscalYearStart: { type: Number, default: 1 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  leaveApprovalLevels: { type: Number, default: 1 },
  autoApproveAfterDays: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);
