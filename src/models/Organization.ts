import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  logo?: string;
  workDays: number[];
  holidays: Array<{ date: Date; name: string }>;
  timezone: string;
  leaveYearStart: number;
  departments: string[];
  address?: string;
  contactEmail?: string;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true },
  logo: { type: String },
  workDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  holidays: [{
    date: { type: Date, required: true },
    name: { type: String, required: true },
  }],
  timezone: { type: String, default: 'Asia/Kolkata' },
  leaveYearStart: { type: Number, default: 1, min: 1, max: 12 },
  departments: { type: [String], default: ['Engineering', 'HR', 'Finance', 'Marketing', 'Operations'] },
  address: { type: String },
  contactEmail: { type: String },
}, { timestamps: true });

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
