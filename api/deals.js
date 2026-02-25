const fs = require('fs');

const DEALS_FILE = '/tmp/bridge-deals.json';
const SECRET = process.env.KORA_BRIDGE_SECRET || 'kora-api-key-internal';

function loadDeals() {
  try {
    if (fs.existsSync(DEALS_FILE)) {
      const data = fs.readFileSync(DEALS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading deals:', err);
  }
  return [];
}

function saveDeals(deals) {
  try {
    fs.writeFileSync(DEALS_FILE, JSON.stringify(deals, null, 2));
  } catch (err) {
    console.error('Error saving deals:', err);
  }
}

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

  const { method, query } = req;
  const view = query.view || 'pipeline';

  if (method === 'GET') {
    const deals = loadDeals();
    
    if (view === 'inbox') {
      return res.json({ deals: { inbox: deals.filter(d => d.status === 'new') } });
    }
    
    // Pipeline view (grouped by status)
    const pipeline = {
      prospecting: deals.filter(d => d.status === 'prospecting'),
      negotiation: deals.filter(d => d.status === 'negotiation'),
      won: deals.filter(d => d.status === 'won'),
      lost: deals.filter(d => d.status === 'lost'),
    };
    
    return res.json({ deals: pipeline });
  }

  if (method === 'POST') {
    const { action, company, contact, value } = req.body;
    
    if (action === 'create') {
      const deal = {
        id: `deal-${Date.now()}`,
        company,
        contact,
        value,
        status: 'prospecting',
        createdAt: new Date().toISOString(),
      };
      
      let deals = loadDeals();
      deals.push(deal);
      saveDeals(deals);
      
      return res.status(201).json({ deal });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
