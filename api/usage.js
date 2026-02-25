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
    month: new Date().toISOString().slice(0, 7),
    tokens: {
      input: 1250000,
      output: 450000,
    },
    cost: {
      input: '$1.25',
      output: '$0.68',
      total: '$1.93',
    },
    agents: {
      kora: { tokens: 500000, cost: '$0.50' },
      hiro: { tokens: 300000, cost: '$0.30' },
      vyllain: { tokens: 250000, cost: '$0.25' },
      nova: { tokens: 200000, cost: '$0.20' },
    },
    budget: {
      month: '$50.00',
      spent: '$1.93',
      remaining: '$48.07',
    },
  });
};
