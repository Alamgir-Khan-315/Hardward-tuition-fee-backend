const Payment = require('../models/Payment');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Admission ke mahine se aaj ke mahine tak har mahine ki fee banti hai.
function monthsCharged(admissionDate, today = new Date()) {
  const a = new Date(admissionDate);
  const m = (today.getFullYear() - a.getFullYear()) * 12 + (today.getMonth() - a.getMonth()) + 1;
  return Math.max(0, m);
}

// Due = (mahine x monthly fee) - jama ki hui fee
function summary(student, paid) {
  const months = monthsCharged(student.admissionDate);
  const totalFee = round2(months * student.monthlyFee);
  const paidAmt = round2(paid || 0);
  return { months, totalFee, paid: paidAmt, due: round2(Math.max(0, totalFee - paidAmt)) };
}

// { studentId: totalPaid }
async function paidTotals() {
  const rows = await Payment.aggregate([{ $group: { _id: '$student', total: { $sum: '$amount' } } }]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

// Ek fee-month ke liye { studentId: paid }
async function paidForMonth(month, year) {
  const rows = await Payment.aggregate([
    { $match: { month, year } },
    { $group: { _id: '$student', total: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

// Mahine ki report: kitni fee banti hai, kitni jama hui, kitni baqaya
function monthSummary(students, paidMap, month, year) {
  const end = new Date(year, month, 0, 23, 59, 59, 999); // is mahine ka aakhri din
  let expected = 0, paid = 0, full = 0, part = 0, none = 0;
  for (const s of students) {
    if (!s.isActive || new Date(s.admissionDate) > end) continue;
    const p = Math.min(paidMap.get(String(s._id)) || 0, s.monthlyFee);
    expected += s.monthlyFee;
    paid += p;
    if (p >= s.monthlyFee) full++;
    else if (p > 0) part++;
    else none++;
  }
  expected = round2(expected);
  paid = round2(paid);
  return {
    expected,
    paid,
    unpaid: round2(expected - paid),
    paidStudents: full,
    partialStudents: part,
    unpaidStudents: none,
    totalStudents: full + part + none,
    paidPercent: expected > 0 ? Math.round((paid / expected) * 100) : 0,
  };
}

module.exports = { round2, monthsCharged, summary, paidTotals, paidForMonth, monthSummary };
