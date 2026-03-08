import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import LeaveType from '../models/LeaveType';
import Settings from '../models/Settings';

dotenv.config();

const seed = async () => {
  const uri = process.env.MONGODB_URI || '';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // ── Leave type definitions ──────────────────────────────────
  const leaveTypeData = [
    { name: 'Annual Leave',    code: 'AL', description: 'General annual vacation leave',   defaultDays: 18, color: '#2563eb', requiresDocument: false, minNoticeDays: 3,  maxConsecutiveDays: 15, carryForward: true,  maxCarryForwardDays: 5 },
    { name: 'Sick Leave',      code: 'SL', description: 'Leave due to illness or medical', defaultDays: 12, color: '#dc2626', requiresDocument: true,  minNoticeDays: 0,  maxConsecutiveDays: 10, carryForward: false },
    { name: 'Casual Leave',    code: 'CL', description: 'Short-notice personal leave',     defaultDays: 6,  color: '#16a34a', requiresDocument: false, minNoticeDays: 1,  maxConsecutiveDays: 3,  carryForward: false },
    { name: 'Maternity Leave', code: 'ML', description: 'Leave for maternity purposes',    defaultDays: 90, color: '#9333ea', requiresDocument: true,  minNoticeDays: 30, maxConsecutiveDays: 90, carryForward: false },
    { name: 'Paternity Leave', code: 'PL', description: 'Leave for paternity purposes',    defaultDays: 10, color: '#0ea5e9', requiresDocument: false, minNoticeDays: 7,  maxConsecutiveDays: 10, carryForward: false },
  ];

  // ── Upsert leave types (safe to run multiple times) ─────────
  const leaveTypes: any[] = [];
  for (const lt of leaveTypeData) {
    const doc = await LeaveType.findOneAndUpdate(
      { code: lt.code },        // find by unique code
      { $setOnInsert: lt },     // only write if inserting new
      { upsert: true, new: true }
    );
    leaveTypes.push(doc);
  }
  console.log('✅ Leave types ready');

  const makeBalances = () =>
    leaveTypes.map(lt => ({
      leaveTypeId: lt._id,
      allocated:   lt.defaultDays,
      used:        0,
      remaining:   lt.defaultDays,
    }));

  // ── Admin ────────────────────────────────────────────────────
  const adminExists = await User.findOne({ email: 'admin@company.com' });
  if (!adminExists) {
    await User.create({ firstName: 'Admin', lastName: 'User', email: 'admin@company.com', password: 'admin123', role: 'admin', department: 'Administration', position: 'System Administrator', employeeId: 'EMP001', leaveBalances: makeBalances() });
    console.log('✅ Admin created:   admin@company.com / admin123');
  } else {
    console.log('⏭️  Admin already exists');
  }

  // ── Manager ──────────────────────────────────────────────────
  const managerExists = await User.findOne({ email: 'manager@company.com' });
  if (!managerExists) {
    await User.create({ firstName: 'Priya', lastName: 'Sharma', email: 'manager@company.com', password: 'manager123', role: 'manager', department: 'Engineering', position: 'Engineering Manager', employeeId: 'EMP002', leaveBalances: makeBalances() });
    console.log('✅ Manager created: manager@company.com / manager123');
  } else {
    console.log('⏭️  Manager already exists');
  }

  // ── Employees ────────────────────────────────────────────────
  const employees = [
    { firstName: 'Rajan',  lastName: 'Kumar', email: 'rajan@company.com',  department: 'Engineering', position: 'Senior Developer', employeeId: 'EMP003' },
    { firstName: 'Anita',  lastName: 'Patel', email: 'anita@company.com',  department: 'HR',          position: 'HR Executive',      employeeId: 'EMP004' },
    { firstName: 'Vikram', lastName: 'Singh', email: 'vikram@company.com', department: 'Finance',     position: 'Finance Analyst',   employeeId: 'EMP005' },
    { firstName: 'Deepa',  lastName: 'Nair',  email: 'deepa@company.com',  department: 'Engineering', position: 'QA Engineer',       employeeId: 'EMP006' },
  ];
  for (const emp of employees) {
    const exists = await User.findOne({ email: emp.email });
    if (!exists) await User.create({ ...emp, password: 'emp123', role: 'employee', leaveBalances: makeBalances() });
  }
  console.log('✅ Employees ready  (password: emp123)');

  // ── Settings ─────────────────────────────────────────────────
  await Settings.findOneAndUpdate({}, {
    orgName: 'TechCorp India Pvt Ltd', workDays: [1,2,3,4,5],
    fiscalYearStart: 4, timezone: 'Asia/Kolkata',
    leaveApprovalLevels: 1,   // change to 2 for 2-level approval
    holidays: [
      { date: new Date('2025-01-26'), name: 'Republic Day'     },
      { date: new Date('2025-08-15'), name: 'Independence Day' },
      { date: new Date('2025-10-02'), name: 'Gandhi Jayanti'   },
      { date: new Date('2025-12-25'), name: 'Christmas'        },
    ],
  }, { upsert: true });
  console.log('✅ Settings configured');

  console.log('\n🎉 Seed complete! Login with:');
  console.log('   Admin    → admin@company.com    / admin123');
  console.log('   Manager  → manager@company.com  / manager123');
  console.log('   Employee → rajan@company.com    / emp123');

  await mongoose.disconnect();
};

seed().catch(e => { console.error(e); process.exit(1); });