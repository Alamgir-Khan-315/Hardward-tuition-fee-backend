const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { asyncHandler, HttpError } = require('../middleware/helpers');
const Setting = require('../models/Setting');
const { getWaConfig, mask } = require('../utils/wa');

const router = express.Router();

// API key kabhi poori client ko nahi bheji jati, sirf chhota sa mask
async function getMaskedKey() {
  return mask((await getWaConfig()).key);
}
router.getMaskedKey = getMaskedKey;


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bohat zyada koshishein. 15 minute baad dobara try karein.' },
});

const schema = z.object({
  username: z.string().trim().min(1, 'Username likhein'),
  password: z.string().min(1, 'Password likhein'),
  waApiKey: z.string().trim().max(1000).optional(),
  waPhoneId: z.string().trim().regex(/^[0-9]{0,30}$/, 'Phone Number ID sirf number hota hai').optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Number zaroori hai, sahi likhein (jaise 03001234567)'),
});

// Owner ka number sirf sahi username + password dene par badalta hai
router.put(
  '/owner-phone',
  limiter,
  asyncHandler(async (req, res) => {
    const { username, password, phone, waApiKey, waPhoneId } = schema.parse(req.body);
    const adminUser = (process.env.ADMIN_USERNAME || '').toLowerCase();
    const hash = process.env.ADMIN_PASSWORD_HASH || '';
    const ok = adminUser && hash && username.toLowerCase() === adminUser && bcrypt.compareSync(password, hash);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600));
      throw new HttpError(401, 'Username ya password galat hai.');
    }
    await Setting.findByIdAndUpdate('ownerPhone', { value: phone }, { upsert: true });
    if (waApiKey) await Setting.findByIdAndUpdate('waApiKey', { value: waApiKey }, { upsert: true });
    if (waPhoneId) await Setting.findByIdAndUpdate('waPhoneId', { value: waPhoneId }, { upsert: true });
    const wa = await getWaConfig();
    res.json({ academyPhone: phone, waApiKeyMasked: mask(wa.key), waPhoneId: wa.phoneId, waApiReady: !!(wa.key && wa.phoneId) });
  })
);

module.exports = router;
