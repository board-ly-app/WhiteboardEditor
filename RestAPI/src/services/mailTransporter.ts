// === mailTransporter.ts ======================================================
//
// Nodemailer transporter.
//
// =============================================================================

import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_USER,
  SMTP_PASS,
} = process.env;

if (! SMTP_HOST) throw new Error('Env var SMTP_HOST not provided');
if (! SMTP_USER) throw new Error('Env var SMTP_USER not provided');
if (! SMTP_PASS) throw new Error('Env var SMTP_PASS not provided');

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});// -- end export const transporter
