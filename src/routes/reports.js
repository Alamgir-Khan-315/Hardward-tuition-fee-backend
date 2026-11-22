const express = require('express');
const Student = require('../models/Student');
const { asyncHandler } = require('../middleware/helpers');
const { paidForMonth, monthSummary } = require('../utils/fee');

const router = express.Router();

// Is mahine kitni fee jama hui aur kitni baqaya hai.
router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const month = Number(req.query.month) >= 1 && Number(req.query.month) <= 12 ? Number(req.query.month) : now.getMonth() + 1;
    const year = Number(req.query.year) >= 2000 && Number(req.query.year) <= 2100 ? Number(req.query.year) : now.getFullYear();
    const [students, paidMap] = await Promise.all([Student.find().lean(), paidForMonth(month, year)]);
    res.json({ month, year, report: monthSummary(students, paidMap, month, year) });
  })
);

module.exports = router;
