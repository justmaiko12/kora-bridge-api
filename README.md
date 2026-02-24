# Kora Bridge API

Bridge service syncing OpenClaw tasks, activity, and usage with Mission Control dashboard.

## Features

- **Task Management** - Create, read, update, delete tasks
- **Activity Logging** - Real-time activity feed with agent metadata
- **Usage Tracking** - Cost and token tracking per agent/model
- **Agent Status** - Track all 4 agents (Kora, HIRO, Vyllain, Nova)

## Setup

```bash
npm install
KORA_BRIDGE_SECRET=your-secret node server.js
```

## API Endpoints

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Activity
- `GET /api/activity/log` - Get activity feed
- `POST /api/activity/log` - Log activity
- `GET /api/activity/summary` - Get activity summary per agent

### Usage
- `GET /api/usage` - Get usage stats
- `POST /api/usage` - Record usage event

### Agents
- `GET /api/agents` - List all agents
- `PUT /api/agents/:id` - Update agent status

### Health
- `GET /health` - Health check

## Authentication

All endpoints require:
```
Authorization: Bearer {KORA_BRIDGE_SECRET}
```

## Configuration

```bash
export KORA_BRIDGE_URL=http://localhost:3001
export KORA_BRIDGE_SECRET=kora-secret-key-change-me
export PORT=3001
```

## Data Storage

- `tasks.json` - Task storage
- `usage.json` - Usage analytics
- `agents.json` - Agent registry
- `activity.jsonl` - Activity log (one event per line)

## Integration with Mission Control

Configure in Mission Control `.env`:
```
KORA_BRIDGE_URL=http://localhost:3001
KORA_BRIDGE_SECRET=kora-secret-key-change-me
```

Then run Mission Control:
```bash
npm run dev
# Navigate to localhost:3000
# Tasks, Activity, and Usage sections now pull from Bridge API
```

## Python Integration

```python
from mission_control_sync import MissionControlSync
from activity_tracker import activity
from usage_tracker import usage
from agent_status import agent_status

# Create task
sync = MissionControlSync()
task = sync.create_task('My Task', 'Description', priority='high')

# Log activity
activity.task_created('kora', 'My Task', task['id'])

# Track usage
usage.record('kora', 'claude-3-haiku', 500, 250)

# Update agent status
agent_status.set_working('kora')
```

## License

MIT
