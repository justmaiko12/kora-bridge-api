#!/usr/bin/env node
/**
 * Kora Bridge API
 * Syncs OpenClaw tasks with Mission Control
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Simple in-memory task storage (persisted to JSON)
const TASKS_FILE = path.join(__dirname, 'tasks.json');
// Support both KORA_BRIDGE_SECRET and generic Bearer token
const SECRET = process.env.KORA_BRIDGE_SECRET || process.env.BRIDGE_SECRET || 'kora-api-key-internal';

app.use(express.json());

// Load tasks from disk
function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tasks:', err);
  }
  return [];
}

// Save tasks to disk
function saveTasks(tasks) {
  try {
    fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error saving tasks:', err);
  }
}

let tasks = loadTasks();

// Middleware: Auth
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  const token = auth?.split(' ')[1];
  
  if (!token || token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /api/tasks - List all tasks
app.get('/api/tasks', (req, res) => {
  res.json({ tasks, count: tasks.length });
});

// POST /api/tasks - Create task
app.post('/api/tasks', (req, res) => {
  const { title, description, priority = 'medium', dueDate, status = 'pending' } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }
  
  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    priority,
    status,
    dueDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  tasks.push(task);
  saveTasks(tasks);
  
  console.log(`✅ Task created: ${title}`);
  res.status(201).json({ task });
});

// PUT /api/tasks/:id - Update task
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const task = tasks[taskIndex];
  const updatedTask = {
    ...task,
    ...updates,
    id: task.id,  // Don't allow ID change
    createdAt: task.createdAt,  // Don't allow creation date change
    updatedAt: new Date().toISOString(),
  };
  
  tasks[taskIndex] = updatedTask;
  saveTasks(tasks);
  
  console.log(`✅ Task updated: ${updatedTask.title} (${updatedTask.status})`);
  res.json({ task: updatedTask });
});

// DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const [deleted] = tasks.splice(taskIndex, 1);
  saveTasks(tasks);
  
  console.log(`✅ Task deleted: ${deleted.title}`);
  res.json({ success: true, task: deleted });
});

// Activity logging
const ACTIVITY_FILE = path.join(__dirname, 'activity.jsonl');

function logActivity(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  try {
    fs.appendFileSync(ACTIVITY_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

function loadActivityLog(limit = 100) {
  try {
    if (!fs.existsSync(ACTIVITY_FILE)) return [];
    
    const lines = fs.readFileSync(ACTIVITY_FILE, 'utf8').split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch (err) {
    console.error('Error loading activity:', err);
    return [];
  }
}

// GET /api/activity/log - Get activity history with agent metadata
app.get('/api/activity/log', (req, res) => {
  const activities = loadActivityLog(50);
  
  // Enrich with agent metadata
  const enrichedActivities = activities.map(activity => ({
    ...activity,
    agentName: agents[activity.agent]?.name || activity.agent,
    agentRole: agents[activity.agent]?.role || 'Unknown',
    agentColor: agents[activity.agent]?.color || '#6b7280'
  }));
  
  res.json({ 
    activities: enrichedActivities, 
    count: enrichedActivities.length,
    agents: Object.entries(agents).map(([id, data]) => ({ id, ...data }))
  });
});

// POST /api/activity/log - Log activity
app.post('/api/activity/log', (req, res) => {
  const { type, agent, message, data } = req.body;
  
  logActivity({
    type: type || 'unknown',
    agent: agent || 'system',
    message: message || '',
    data: data || {}
  });
  
  console.log(`📝 Activity logged: ${agent} - ${message}`);
  res.status(201).json({ success: true });
});

// GET /api/activity/summary - Activity summary per agent
app.get('/api/activity/summary', (req, res) => {
  const activities = loadActivityLog(200);
  const summary = {};
  
  // Initialize all agents
  Object.keys(agents).forEach(agentId => {
    summary[agentId] = {
      ...agents[agentId],
      totalActivities: 0,
      byType: {}
    };
  });
  
  // Count activities per agent and type
  activities.forEach(activity => {
    const agent = activity.agent;
    if (summary[agent]) {
      summary[agent].totalActivities++;
      summary[agent].byType[activity.type] = (summary[agent].byType[activity.type] || 0) + 1;
    }
  });
  
  const summaryArray = Object.entries(summary)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalActivities - a.totalActivities);
  
  res.json({ summary: summaryArray });
});

// Usage tracking
const USAGE_FILE = path.join(__dirname, 'usage.json');

function loadUsage() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading usage:', err);
  }
  return {
    totalCost: 0,
    totalTokens: 0,
    conversations: 0,
    dailyCosts: [],
    byAgent: {},
    byModel: {}
  };
}

function saveUsage(usage) {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
  } catch (err) {
    console.error('Error saving usage:', err);
  }
}

function updateUsage(agent, model, inputTokens, outputTokens, cost) {
  const usage = loadUsage();
  const today = new Date().toISOString().split('T')[0];
  
  // Update totals
  usage.totalTokens += (inputTokens + outputTokens);
  usage.totalCost += cost;
  
  // Daily costs
  const dayIndex = usage.dailyCosts.findIndex(d => d.date === today);
  if (dayIndex >= 0) {
    usage.dailyCosts[dayIndex].cost += cost;
    usage.dailyCosts[dayIndex].tokens += (inputTokens + outputTokens);
  } else {
    usage.dailyCosts.push({ date: today, cost, tokens: inputTokens + outputTokens });
  }
  
  // By agent
  if (!usage.byAgent[agent]) {
    usage.byAgent[agent] = { cost: 0, tokens: 0, conversations: 0 };
  }
  usage.byAgent[agent].cost += cost;
  usage.byAgent[agent].tokens += (inputTokens + outputTokens);
  
  // By model
  if (!usage.byModel[model]) {
    usage.byModel[model] = { cost: 0, tokens: 0 };
  }
  usage.byModel[model].cost += cost;
  usage.byModel[model].tokens += (inputTokens + outputTokens);
  
  saveUsage(usage);
  return usage;
}

// GET /api/usage - Get usage stats
app.get('/api/usage', (req, res) => {
  const usage = loadUsage();
  
  // Calculate percentages
  const totalCost = usage.totalCost || 0;
  const agentArray = Object.entries(usage.byAgent || {}).map(([name, data]) => ({
    name,
    cost: data.cost,
    tokens: data.tokens,
    conversations: data.conversations,
    percentage: totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : 0
  })).sort((a, b) => b.cost - a.cost);
  
  const modelArray = Object.entries(usage.byModel || {}).map(([name, data]) => ({
    name,
    cost: data.cost,
    tokens: data.tokens,
    percentage: totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : 0
  })).sort((a, b) => b.cost - a.cost);
  
  res.json({
    totalCost: totalCost.toFixed(2),
    totalTokens: usage.totalTokens,
    conversations: usage.conversations || 0,
    activity: loadActivityLog(1).length,
    dailyCosts: usage.dailyCosts.slice(-30),  // Last 30 days
    byAgent: agentArray,
    byModel: modelArray
  });
});

// POST /api/usage - Record usage event
app.post('/api/usage', (req, res) => {
  const { agent = 'unknown', model = 'unknown', inputTokens = 0, outputTokens = 0, cost = 0 } = req.body;
  
  const usage = updateUsage(agent, model, inputTokens, outputTokens, cost);
  
  console.log(`💰 Usage recorded: ${agent} via ${model} (+$${cost.toFixed(4)})`);
  res.json({ success: true, totalCost: usage.totalCost });
});

// Health check
app.get('/health', (req, res) => {
  const usage = loadUsage();
  res.json({
    status: 'ok',
    tasks: tasks.length,
    cost: usage.totalCost.toFixed(2),
    activities: loadActivityLog(1).length
  });
});

// Agent registry
const AGENTS_FILE = path.join(__dirname, 'agents.json');

const DEFAULT_AGENTS = {
  'kora': { name: 'Kora', role: 'Main Assistant', status: 'online', color: '#8b5cf6' },
  'hiro': { name: 'HIRO', role: 'Kreatrix Bot', status: 'online', color: '#ec4899' },
  'vyllain': { name: 'Vyllain', role: 'Content Manager', status: 'online', color: '#f59e0b' },
  'nova': { name: 'Nova', role: 'Business Agent', status: 'online', color: '#10b981' }
};

function loadAgents() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading agents:', err);
  }
  return DEFAULT_AGENTS;
}

function saveAgents(agents) {
  try {
    fs.mkdirSync(path.dirname(AGENTS_FILE), { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
  } catch (err) {
    console.error('Error saving agents:', err);
  }
}

let agents = loadAgents();

// GET /api/agents - List all agents
app.get('/api/agents', (req, res) => {
  const agentList = Object.entries(agents).map(([id, data]) => ({
    id,
    ...data,
    lastActivity: new Date().toISOString()
  }));
  res.json({ agents: agentList, count: agentList.length });
});

// PUT /api/agents/:id - Update agent status
app.put('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  const { status, role } = req.body;
  
  if (!agents[id]) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  if (status) agents[id].status = status;
  if (role) agents[id].role = role;
  agents[id].lastActivity = new Date().toISOString();
  
  saveAgents(agents);
  
  console.log(`🤖 Agent updated: ${id} → ${status || agents[id].status}`);
  res.json({ agent: agents[id] });
});

// Deals Pipeline Storage
const DEALS_FILE = path.join(__dirname, 'deals.json');

function loadDeals() {
  try {
    if (fs.existsSync(DEALS_FILE)) {
      return JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading deals:', err);
  }
  return [];
}

function saveDeals(deals) {
  try {
    fs.mkdirSync(path.dirname(DEALS_FILE), { recursive: true });
    fs.writeFileSync(DEALS_FILE, JSON.stringify(deals, null, 2));
  } catch (err) {
    console.error('Error saving deals:', err);
  }
}

let deals = loadDeals();

// GET /api/deals/pipeline - Get deals pipeline
app.get('/api/deals/pipeline', (req, res) => {
  const { account } = req.query;
  
  // Filter by account if provided
  const filtered = account 
    ? deals.filter(d => d.account === account)
    : deals;
  
  // Group by stage
  const pipeline = {
    prospect: filtered.filter(d => d.stage === 'prospect'),
    contacted: filtered.filter(d => d.stage === 'contacted'),
    interested: filtered.filter(d => d.stage === 'interested'),
    meeting: filtered.filter(d => d.stage === 'meeting'),
    negotiating: filtered.filter(d => d.stage === 'negotiating'),
    closed: filtered.filter(d => d.stage === 'closed'),
    lost: filtered.filter(d => d.stage === 'lost')
  };
  
  res.json({
    pipeline,
    total: filtered.length,
    account: account || 'all',
    timestamp: new Date().toISOString()
  });
});

// GET /api/deals/inbox - Get inbox deals (unread/recent)
app.get('/api/deals/inbox', (req, res) => {
  const { account } = req.query;
  
  const filtered = account 
    ? deals.filter(d => d.account === account && !d.read)
    : deals.filter(d => !d.read);
  
  res.json({
    inbox: filtered.slice(-20),  // Last 20
    count: filtered.length,
    account: account || 'all',
    timestamp: new Date().toISOString()
  });
});

// POST /api/deals/draft - Save draft deal
app.post('/api/deals/draft', (req, res) => {
  const { company, contact, email, stage = 'prospect', account } = req.body;
  
  if (!company || !email) {
    return res.status(400).json({ error: 'Company and email required' });
  }
  
  const deal = {
    id: crypto.randomUUID(),
    company,
    contact: contact || 'Unknown',
    email,
    stage,
    account: account || 'unknown@shluv.com',
    value: null,
    read: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draft: true
  };
  
  deals.push(deal);
  saveDeals(deals);
  
  console.log(`✅ Deal draft created: ${company}`);
  res.status(201).json({ deal });
});

// POST /api/deals/create - Create deal from draft
app.post('/api/deals/create', (req, res) => {
  const { id, value } = req.body;
  
  const dealIndex = deals.findIndex(d => d.id === id);
  if (dealIndex === -1) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  
  const deal = deals[dealIndex];
  deal.draft = false;
  deal.value = value;
  deal.updatedAt = new Date().toISOString();
  
  deals[dealIndex] = deal;
  saveDeals(deals);
  
  console.log(`✅ Deal created: ${deal.company} ($${value})`);
  res.json({ deal });
});

// PUT /api/deals/update - Update deal
app.put('/api/deals/update', (req, res) => {
  const { id, stage, value, notes, deadline } = req.body;
  
  const dealIndex = deals.findIndex(d => d.id === id);
  if (dealIndex === -1) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  
  const deal = deals[dealIndex];
  if (stage) deal.stage = stage;
  if (value !== undefined) deal.value = value;
  if (notes) deal.notes = notes;
  if (deadline) deal.deadline = deadline;
  deal.read = true;
  deal.updatedAt = new Date().toISOString();
  
  deals[dealIndex] = deal;
  saveDeals(deals);
  
  console.log(`✅ Deal updated: ${deal.company} → ${stage || deal.stage}`);
  res.json({ deal });
});

// DELETE /api/deals/delete - Delete deal
app.delete('/api/deals/delete', (req, res) => {
  const { id } = req.body;
  
  const dealIndex = deals.findIndex(d => d.id === id);
  if (dealIndex === -1) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  
  const [deleted] = deals.splice(dealIndex, 1);
  saveDeals(deals);
  
  console.log(`✅ Deal deleted: ${deleted.company}`);
  res.json({ success: true, deal: deleted });
});

// POST /api/deals/link - Link email to deal
app.post('/api/deals/link', (req, res) => {
  const { dealId, email } = req.body;
  
  if (!dealId || !email) {
    return res.status(400).json({ error: 'dealId and email required' });
  }
  
  const dealIndex = deals.findIndex(d => d.id === dealId);
  if (dealIndex === -1) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  
  const deal = deals[dealIndex];
  if (!deal.linkedEmails) deal.linkedEmails = [];
  if (!deal.linkedEmails.includes(email)) {
    deal.linkedEmails.push(email);
  }
  deal.updatedAt = new Date().toISOString();
  
  deals[dealIndex] = deal;
  saveDeals(deals);
  
  console.log(`✅ Email linked to deal: ${deal.company}`);
  res.json({ deal });
});

// GET /api/briefing - Dashboard briefing data
app.get('/api/briefing', (req, res) => {
  // Return briefing structure with current data
  // AI News, K-pop News, Team Tasks, Content Today
  
  const briefing = {
    aiNews: {
      items: [
        // TODO: Fetch from news API
      ],
      lastUpdated: new Date().toISOString(),
    },
    kpopNews: {
      items: [
        // TODO: Fetch from K-pop source
      ],
      lastUpdated: new Date().toISOString(),
    },
    teamTasks: {
      items: tasks.filter(t => t.status !== 'completed').slice(0, 5),
      lastUpdated: new Date().toISOString(),
    },
    content: {
      items: [
        // TODO: Fetch from content DB
      ],
      lastUpdated: new Date().toISOString(),
    },
    preferences: {
      aiNews: { liked: [], disliked: [], notes: '' },
      kpopNews: { liked: [], disliked: [], notes: '' },
    },
  };
  
  res.json(briefing);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Kora Bridge API running on http://localhost:${PORT}`);
  console.log(`📊 Tasks: ${tasks.length} loaded from disk`);
  console.log(`💼 Deals: ${deals.length} loaded from disk`);
  console.log(`🤖 Agents: ${Object.keys(agents).length} registered`);
  console.log(`🔐 Secret: ${SECRET.substring(0, 10)}...`);
});
