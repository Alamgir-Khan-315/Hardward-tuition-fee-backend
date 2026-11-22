const express = require('express');
const { z } = require('zod');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { asyncHandler, HttpError } = require('../middleware/helpers');
const { round2, paidForMonth } = require('../utils/fee');

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (v) => 'Rs ' + Math.round(v).toLocaleString('en-US');

const paySchema = z.object({
  studentId: z.string().min(1, 'Student chunein'),
  month: z.coerce.number().int().min(1, 'Mahina galat hai').max(12, 'Mahina galat hai'),
  year: z.coerce.number().int().min(2000, 'Saal galat hai').max(2100, 'Saal galat hai'),
  amount: z.coerce.number({ invalid_type_error: 'Amount likhein' }).positive('Amount 0 se zyada likhein'),
  remarks: z.string().trim().max(200).optional().default(''),
});

const editSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number({ invalid_type_error: 'Amount likhein' }).positive('Amount 0 se zyada likhein'),
  paymentDate: z.coerce.date({ invalid_type_error: 'Payment date sahi likhein' }),
  remarks: z.string().trim().max(200).optional().default(''),
});

// Mahina select karein, us mahine ke sab active students ki list.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const month = Number(req.query.month) >= 1 && Number(req.query.month) <= 12 ? Number(req.query.month) : now.getMonth() + 1;
    const year = Number(req.query.year) >= 2000 && Number(req.query.year) <= 2100 ? Number(req.query.year) : now.getFullYear();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const filter = { isActive: true, admissionDate: { $lte: monthEnd } };
    if (req.query.q && String(req.query.q).trim()) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ studentName: rx }, { studentCode: rx }, { parentName: rx }, { className: rx }];
    }
    const [students, paidMap] = await Promise.all([Student.find(filter).sort({ studentName: 1 }).lean(), paidForMonth(month, year)]);

    const rows = students.map((s) => {
      const paid = paidMap.get(String(s._id)) || 0;
      return { student: s, paid: round2(paid), balance: round2(Math.max(0, s.monthlyFee - paid)) };
    });
    res.json({ month, year, rows });
  })
);

router.post(
  '/pay',
  asyncHandler(async (req, res) => {
    const { studentId, month, year, amount, remarks } = paySchema.parse(req.body);
    const student = await Student.findById(studentId);
    if (!student) throw new HttpError(404, 'Student nahi mila');

    const paid = (await paidForMonth(month, year)).get(String(student._id)) || 0;
    const remaining = round2(student.monthlyFee - paid);
    if (remaining <= 0) throw new HttpError(400, `${student.studentName} ki ${MONTHS[month]} ${year} ki fee pehle hi mukammal ada hai.`);
    if (amount > remaining) throw new HttpError(400, `Is mahine ki sirf ${money(remaining)} fee baqaya hai. Isse zyada jama nahi ho sakti.`);

    const payment = await Payment.create({ student: student._id, month, year, amount: round2(amount), paymentDate: new Date(), remarks });
    res.status(201).json({ payment, student, monthBalance: round2(remaining - amount) });
  })
);

router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.q && String(req.query.q).trim()) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      const ids = await Student.find({ $or: [{ studentName: rx }, { studentCode: rx }] }).distinct('_id');
      filter.student = { $in: ids };
    }
    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .populate('student', 'studentName studentCode')
      .lean();
    res.json(payments);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id).populate('student').lean();
    if (!payment) throw new HttpError(404, 'Fee record nahi mila');
    res.json(payment);
  })
);

// Galti se fee jama ho gayi ho to edit.
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = editSchema.parse(req.body);
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new HttpError(404, 'Fee record nahi mila');
    const student = await Student.findById(payment.student);
    if (!student) throw new HttpError(404, 'Student nahi mila');

    const others = await Payment.aggregate([
      { $match: { student: student._id, month: data.month, year: data.year, _id: { $ne: payment._id } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const remaining = round2(student.monthlyFee - (others[0] ? others[0].total : 0));
    if (data.amount > remaining) {
      throw new HttpError(400, `Is mahine ki zyada se zyada ${money(Math.max(0, remaining))} jama ho sakti hai.`);
    }

    Object.assign(payment, { ...data, amount: round2(data.amount) });
    await payment.save();
    res.json(payment);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) throw new HttpError(404, 'Fee record nahi mila');
    res.json({ ok: true });
  })
);

module.exports = router;
