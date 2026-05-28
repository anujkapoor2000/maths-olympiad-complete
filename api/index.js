// Vercel serverless entry point.
//
// vercel.json rewrites every /api/* request to this function (the original URL is
// preserved), so the Express app in server.js matches the full request path
// (e.g. /api/auth/login) against its own route table.
module.exports = require('../server.js');
