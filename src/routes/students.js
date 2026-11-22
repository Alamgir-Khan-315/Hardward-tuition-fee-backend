const express = require('express');
const { z } = require('zod');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const { asyncHandler, HttpError } = require('../middleware/helpers');
const { summary, paidTotals } = require('../utils/fee');

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const studentSchema = z.object({
  studentName: z.string().trim().min(1, 'Student ka naam likhein').max(100),
  parentName: z.string().trim().min(1, 'Parent ka naam likhein').max(100),
  parentWhatsApp: z.string().trim().regex(/^[0-9+\s-]{10,16}$/, 'Sahi WhatsApp number likhein (jaise 0300 1234567)'),
  className: z.string().trim().min(1, 'Class likhein').max(50),
  monthlyFee: z.coerce.number({ invalid_type_error: 'Monthly fee likhein' }).min(1, 'Monthly fee 0 se zyada honi chahiye').max(10000000),
  admissionDate: z.coerce.date({ invalid_type_error: 'Admission date sahi likhein' }),
  isActive: z.boolean().optional().default(true),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, status } = req.query;
    const filter = {};
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
      filter.$or = [{ studentName: rx }, { parentName: rx }, { studentCode: rx }, { className: rx }, { parentWhatsApp: rx }];
    }
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const [students, totals] = await Promise.all([
      Student.find(filter).sort({ studentName: 1 }).lean(),
      paidTotals(),
    ]);
    res.json(students.map((s) => ({ ...s, summary: summary(s, totals.get(String(s._id))) })));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = studentSchema.parse(req.body);
    const seq = await Counter.next('student');
    const student = await Student.create({ ...data, studentCode: 'STU-' + String(seq).padStart(4, '0') });
    res.status(201).json(student);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id).lean();
    if (!student) throw new HttpError(404, 'Student nahi mila');
    const payments = await Payment.find({ student: student._id }).sort({ year: -1, month: -1, createdAt: -1 }).lean();
    const paid = payments.reduce((t, p) => t + p.amount, 0);
    res.json({ ...student, summary: summary(student, paid), payments });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = studentSchema.parse(req.body);
    // studentCode kabhi change nahi hota
    const student = await Student.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!student) throw new HttpError(404, 'Student nahi mila');
    res.json(student);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) throw new HttpError(404, 'Student nahi mila');
    await Payment.deleteMany({ student: student._id }); // iski fee records bhi delete
    res.json({ ok: true });
  })
);

module.exports = router;
