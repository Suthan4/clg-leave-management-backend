import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'employee';
  department: string;
  position: string;
  employeeId: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  managerId?: mongoose.Types.ObjectId;
  leaveBalances: {
    leaveTypeId: mongoose.Types.ObjectId;
    allocated: number;
    used: number;
    remaining: number;
  }[];
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
}

const UserSchema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
  department: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  employeeId: { type: String, required: true, unique: true },
  phone: { type: String },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User' },
  leaveBalances: [{
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType' },
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 }
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verificationCode: String,
  verificationCodeExpires: Date,
}, { timestamps: true });

UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
