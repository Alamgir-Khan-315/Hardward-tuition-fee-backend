const express = require('express');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { asyncHandler } = require('../middleware/helpers');
const { round2, summary, paidTotals, paidForMonth, monthSummary } = require('../utils/fee');

const router = express.Router();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [students, totals, monthPaid] = await Promise.all([Student.find().lean(), paidTotals(), paidForMonth(month, year)]);
    const active = students.filter((s) => s.isActive);

    let totalFee = 0, totalDue = 0;
    const followUps = [];
    for (const s of active) {
      const sum = summary(s, totals.get(String(s._id)));
      totalFee += sum.totalFee;
      totalDue += sum.due;
      if (sum.due > 0) followUps.push({ student: s, summary: sum });
    }
    followUps.sort((a, b) => b.summary.due - a.summary.due);

    // Pichle 6 mahine ki wasooli (payment date ke hisaab se)
    const start = new Date(year, month - 1 - 5, 1);
    const recent = await Payment.find({ paymentDate: { $gte: start } }, 'paymentDate amount').lean();
    const byKey = new Map();
    for (const p of recent) {
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      byKey.set(key, (byKey.get(key) || 0) + p.amount);
    }
    const labels = [], values = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      labels.push(`${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
      values.push(round2(byKey.get(`${d.getFullYear()}-${d.getMonth() + 1}`) || 0));
    }

    const thisMonthCollected = values[values.length - 1];
    const totalAgg = await Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);

    const recentPayments = await Payment.find()
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(5)
      .populate('student', 'studentName studentCode')
      .lean();

    res.json({
      totalStudents: students.length,
      activeStudents: active.length,
      totalFee: round2(totalFee),
      totalCollected: round2(totalAgg[0] ? totalAgg[0].total : 0),
      totalDue: round2(totalDue),
      thisMonthCollected,
      thisMonth: monthSummary(students, monthPaid, month, year),
      chart: { labels, values },
      followUps,
      recentPayments,
    });
  })
);

module.exports = router;
