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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.json({
    sessions: [
      {
        id: 'kora-main',
        name: 'Kora',
        status: 'idle',
        currentTask: null,
        lastHeartbeat: new Date().toISOString(),
        progress: 0,
        type: 'assistant',
      },
      {
        id: 'hiro-kreatrix',
        name: 'HIRO',
        status: 'idle',
        lastHeartbeat: new Date().toISOString(),
        type: 'bot',
      },
      {
        id: 'vyllain-content',
        name: 'Vyllain',
        status: 'idle',
        lastHeartbeat: new Date().toISOString(),
        type: 'agent',
      },
    ],
    activeCount: 0,
    recentCompletions: [],
    updatedAt: new Date().toISOString(),
  });
};
