const mongoose = require('mongoose');

// Chhoti key/value settings (jaise owner ka WhatsApp number)
const settingSchema = new mongoose.Schema({ _id: String, value: String });

module.exports = mongoose.model('Setting', settingSchema);
