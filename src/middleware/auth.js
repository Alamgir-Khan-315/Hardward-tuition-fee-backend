// Login hata diya gaya hai: har request ko seedha Admin maana jata hai.
function requireAuth(req, res, next) {
  req.user = { username: 'admin', role: 'Admin' };
  next();
}

module.exports = { requireAuth };
