const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
process.env.TZ = process.env.TZ || 'Asia/Karachi'; // mahine/din ka hisaab Pakistan ke waqt ke mutabiq

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { requireAuth } = require('./middleware/auth');
const { errorHandler, asyncHandler } = require('./middleware/helpers');
const Setting = require('./models/Setting');
const { getWaConfig, mask } = require('./utils/wa');

for (const k of ['MONGODB_URI']) {
  if (!process.env[k]) {
    console.error(`.env mein ${k} missing hai. server/.env.example dekhein.`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
// CORS: sirf frontend ke origins ko ijazat (CORS_ORIGINS=a,b mein badal sakte hain)
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://hardward-tuition-fee-fronend.vercel.app,http://localhost:5173')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Serverless (Vercel) mein har request par connection cache se milta hai
let dbPromise;
function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!dbPromise) {
    dbPromise = mongoose
      .connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'tuitionfee', serverSelectionTimeoutMS: 12000 })
      .catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}
app.use('/api', (req, res, next) => (req.path === '/health' ? next() : connectDb().then(() => next(), next)));

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

app.get('/api/config', requireAuth, asyncHandler(async (req, res) => {
  const saved = await Setting.findById('ownerPhone').lean();
  const wa = await getWaConfig();
  res.json({
    academyName: process.env.ACADEMY_NAME || 'Academy',
    academyPhone: saved ? saved.value || '' : process.env.ACADEMY_PHONE || '',
    countryCode: process.env.COUNTRY_CODE || '92',
    waApiKeyMasked: mask(wa.key),
    waPhoneId: wa.phoneId,
    waApiReady: !!(wa.key && wa.phoneId),
  });
}));
app.use('/api/whatsapp', requireAuth, require('./routes/whatsapp'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/students', requireAuth, require('./routes/students'));
app.use('/api/fees', requireAuth, require('./routes/fees'));
app.use('/api/reports', requireAuth, require('./routes/reports'));
app.use('/api', (req, res) => res.status(404).json({ message: 'API route nahi mila' }));

// Production: React build (client/dist) isi server se serve hoti hai
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDb();
    console.log('MongoDB Atlas connect ho gaya');
  } catch (err) {
    console.error('MongoDB connect nahi hua:', err.message);
    console.error('Check karein: Atlas > Network Access mein apna IP (ya 0.0.0.0/0) allow hai, aur .env ka password sahi hai.');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`Server chal raha hai: http://localhost:${PORT}`));
}

if (require.main === module) start();
module.exports = app;
