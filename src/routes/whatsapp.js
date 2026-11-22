const express = require('express');
const { z } = require('zod');
const { asyncHandler, HttpError } = require('../middleware/helpers');
const { getWaConfig } = require('../utils/wa');

const router = express.Router();

const schema = z.object({
  to: z.string().regex(/^[0-9]{8,15}$/, 'Number sahi nahi'),
  message: z.string().min(1).max(4000),
});

// WhatsApp Cloud API se seedha message bhejta hai
router.post(
  '/send',
  asyncHandler(async (req, res) => {
    const { to, message } = schema.parse(req.body);
    const { key, phoneId } = await getWaConfig();
    if (!key || !phoneId) throw new HttpError(400, 'WhatsApp API set nahi hai (key aur Phone Number ID Settings mein dein)');

    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: message } }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, (data.error && data.error.message) || 'WhatsApp ne message qabool nahi kiya');
    res.json({ ok: true });
  })
);

module.exports = router;
