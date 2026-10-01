/**
 * Longchase Enterprise Limited — backend
 * ---------------------------------------------------------------
 * A small, self-contained Express server that does two jobs:
 *   1. Serves the static website (the ../index.html, css/, js/ files)
 *   2. Provides a /api/contact endpoint for the contact form
 *
 * No database setup required — submissions are appended to a local
 * JSON file. If SMTP credentials are supplied in .env, it will also
 * email each submission to the business inbox.
 * ---------------------------------------------------------------
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');
const SITE_ROOT = path.join(__dirname, '..');

const allowedOrigins = [
  'https://longchase-entreprise.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.static(SITE_ROOT)); // serves index.html, css/, js/ as-is

/* ---------- helpers ---------- */

async function ensureDataFile() {
  await fsPromises.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fsPromises.access(DATA_FILE);
  } catch {
    await fsPromises.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Only wired up if SMTP_* variables are present in .env — otherwise
// submissions are simply stored locally and logged to the console.
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/* ---------- routes ---------- */

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};

  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!email || !isValidEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!message || message.trim().length < 5) errors.message = 'Please add a short message.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const submission = {
    id: Date.now().toString(36),
    name: name.trim(),
    email: email.trim(),
    phone: (phone || '').trim(),
    message: message.trim(),
    receivedAt: new Date().toISOString(),
  };

  // 1. Always store the submission locally, so nothing is lost even
  //    if email sending isn't configured or temporarily fails.
  try {
    await ensureDataFile();
    const existing = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
    existing.push(submission);
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
  } catch (err) {
    console.error('Could not save submission to disk:', err);
  }

  // 2. Optionally email it, if SMTP has been configured in .env.
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
        to: process.env.CONTACT_TO_EMAIL || 'info@longchase.co.ke',
        replyTo: submission.email,
        subject: `Website enquiry from ${submission.name}`,
        text: [
          submission.message,
          '',
          `Name: ${submission.name}`,
          `Email: ${submission.email}`,
          `Phone: ${submission.phone || 'n/a'}`,
        ].join('\n'),
      });
    } catch (err) {
      // The submission is already saved above, so a failed email is
      // not fatal — just log it for the site owner to notice.
      console.error('Email send failed (submission was still saved):', err);
    }
  } else {
    console.log('New contact submission (SMTP not configured, stored locally only):', submission);
  }

  res.json({ success: true, message: "Thanks, we've received your message and will be in touch." });
});

// Protected admin route to read stored submissions during development.
// Disabled unless ADMIN_TOKEN is set in .env — see .env.example.
app.get('/api/contact', async (req, res) => {
  const token = req.header('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    await ensureDataFile();
    const existing = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
    res.json(existing);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not read submissions.' });
  }
});

app.listen(PORT, () => {
  console.log(`Longchase site + API running at http://localhost:${PORT}`);
});
