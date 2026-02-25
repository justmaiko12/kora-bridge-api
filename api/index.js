module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: 'ok',
    name: 'Kora Bridge API',
    version: '1.0.0',
    endpoints: [
      'GET /api/tasks',
      'POST /api/tasks',
      'GET /api/briefing',
      'GET /api/activity',
      'POST /api/activity',
      'GET /api/deals?view=pipeline|inbox',
      'POST /api/deals (action: create|update|delete)',
    ],
  });
};
