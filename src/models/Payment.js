const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    amount: { type: Number, required: true, min: 1 },
    paymentDate: { type: Date, required: true, default: Date.now },
    remarks: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ student: 1, year: 1, month: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
