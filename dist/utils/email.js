"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLeaveStatusEmail = exports.sendVerificationCode = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: "harisuthan268@gmail.com",
        pass: "waee dcog utuv faoy",
    },
});
const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"Leave Management System" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
    }
    catch (error) {
        console.error('Email send error:', error);
        throw new Error('Failed to send email');
    }
};
exports.sendEmail = sendEmail;
const sendVerificationCode = async (to, code) => {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e3a5f;">Password Reset Verification</h2>
      <p>Your verification code is:</p>
      <div style="background: #f0f4ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${code}</span>
      </div>
      <p style="color: #666;">This code expires in <strong>15 minutes</strong>.</p>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
    await (0, exports.sendEmail)(to, 'Password Reset Verification Code', html);
};
exports.sendVerificationCode = sendVerificationCode;
const sendLeaveStatusEmail = async (to, status, leaveDates, comment) => {
    const color = status === 'approved' ? '#16a34a' : '#dc2626';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e3a5f;">Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
      <p>Your leave request for <strong>${leaveDates}</strong> has been <strong style="color: ${color};">${status}</strong>.</p>
      ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
      <p>Login to your dashboard for more details.</p>
    </div>
  `;
    await (0, exports.sendEmail)(to, `Leave Request ${status}`, html);
};
exports.sendLeaveStatusEmail = sendLeaveStatusEmail;
