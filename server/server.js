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
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const configuredNotificationEmail = process.env.CONTACT_TO_EMAIL;
const NOTIFICATION_EMAIL = configuredNotificationEmail && configuredNotificationEmail !== 'info@longchase.co.ke'
  ? configuredNotificationEmail
  : 'longchaseenterpriselimited@gmail.com';
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
  await fsPromises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsPromises.access(DATA_FILE);
  } catch {
    await fsPromises.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readReviews() {
  await fsPromises.mkdir(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(await fsPromises.readFile(REVIEWS_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fsPromises.writeFile(REVIEWS_FILE, '[]', 'utf8');
    return [];
  }
}

let reviewWriteQueue = Promise.resolve();

function appendReview(review) {
  reviewWriteQueue = reviewWriteQueue.then(async () => {
    const reviews = await readReviews();
    reviews.push(review);
    const temporaryFile = `${REVIEWS_FILE}.${process.pid}.tmp`;
    await fsPromises.writeFile(temporaryFile, JSON.stringify(reviews, null, 2), 'utf8');
    await fsPromises.rename(temporaryFile, REVIEWS_FILE);
  });
  return reviewWriteQueue;
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
        to: NOTIFICATION_EMAIL,
        replyTo: submission.email,
        subject: 'ENQUIRY',
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

  res.json({
    success: true,
    message: "Thanks, we've received your message and will be in touch.",
  });
});

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await readReviews();
    res.json(reviews
      .sort((first, second) => new Date(second.submittedAt) - new Date(first.submittedAt))
      .map(({ email, ...publicReview }) => publicReview));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load reviews.' });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { name, company, rating, experience } = req.body || {};
  const numericRating = Number(rating);
  if (!name || name.trim().length < 2 || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 || !experience || experience.trim().length < 10 || experience.trim().length > 500) {
    return res.status(400).json({ success: false, message: 'Please provide your name, a rating from 1 to 5, and an experience of 10 to 500 characters.' });
  }

  const review = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 100),
    company: (company || '').trim().slice(0, 100),
    rating: numericRating,
    experience: experience.trim(),
    submittedAt: new Date().toISOString(),
  };

  try {
    await appendReview(review);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
          to: NOTIFICATION_EMAIL,
          subject: `New customer review from ${review.name}`,
          text: [
            `Rating: ${review.rating}/5`,
            `Name: ${review.name}`,
            `Company: ${review.company || 'n/a'}`,
            '',
            review.experience,
          ].join('\n'),
        });
      } catch (err) {
        console.error('Review email notification failed (review was still saved):', err);
      }
    } else {
      console.log('New customer review (SMTP not configured, stored locally only):', review);
    }

    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error('Could not save review:', err);
    res.status(500).json({ success: false, message: 'Could not save your review.' });
  }
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
