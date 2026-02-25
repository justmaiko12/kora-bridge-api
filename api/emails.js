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

  // Return empty structure (email integration pending)
  return res.json({
    accounts: [],
    emails: [],
    count: 0,
  });
};
