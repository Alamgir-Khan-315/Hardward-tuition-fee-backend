// Naya admin password ka hash banane ke liye:  npm run hash --prefix server -- MeraNayaPassword
const bcrypt = require('bcryptjs');
const pw = process.argv[2];
if (!pw) { console.log('Istemal: npm run hash --prefix server -- <password>'); process.exit(1); }
console.log(bcrypt.hashSync(pw, 10));
