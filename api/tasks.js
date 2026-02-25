const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use /tmp for Vercel (filesystem is read-only except /tmp)
const TASKS_FILE = '/tmp/bridge-tasks.json';
const SECRET = process.env.KORA_BRIDGE_SECRET || 'kora-api-key-internal';

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

function saveTasks(tasks) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error saving tasks:', err);
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

  const { method } = req;

  if (method === 'GET') {
    const tasks = loadTasks();
    return res.json({ tasks, count: tasks.length });
  }

  if (method === 'POST') {
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
    
    let tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);
    
    console.log(`✅ Task created: ${title}`);
    return res.status(201).json({ task });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
