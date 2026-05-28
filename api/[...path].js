// Vercel serverless entry point.
//
// This catch-all route ([...path]) receives every request under /api/* and hands
// it to the Express application defined in server.js. Express then matches the
// full request path (e.g. /api/auth/login) against its own route table.
module.exports = require('../server.js');
