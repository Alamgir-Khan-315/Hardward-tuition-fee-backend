const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    studentCode: { type: String, unique: true, index: true },
    studentName: { type: String, required: true, trim: true, maxlength: 100 },
    parentName: { type: String, required: true, trim: true, maxlength: 100 },
    parentWhatsApp: { type: String, required: true, trim: true, maxlength: 20 },
    className: { type: String, required: true, trim: true, maxlength: 50 },
    monthlyFee: { type: Number, required: true, min: 1 },
    admissionDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
