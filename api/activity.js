const SECRET = process.env.KORA_BRIDGE_SECRET || 'kora-api-key-internal';

function verifyAuth(req) {
  const auth = req.headers.authorization;
  const token = auth?.split(' ')[1];
  return token === SECRET;
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return res.json({
      sessions: [
        {
          id: 'kora-main',
          name: 'Kora',
          status: 'idle',
          lastHeartbeat: new Date().toISOString(),
        },
      ],
      activeCount: 0,
      recentCompletions: [],
      updatedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    const { endpoint, timestamp, activity } = req.body;
    console.log(`📊 Activity logged: ${endpoint} - ${activity}`);
    return res.json({ success: true, timestamp });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
