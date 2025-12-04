# WebSocket Queue Updates

## Overview

The analysis queue system now provides **real-time updates via WebSocket**, giving users instant feedback on their video analysis jobs without needing to poll for status.

## How It Works

### Connection

Clients connect to the WebSocket namespace `/queue` with JWT authentication:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/queue', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

> **Note**: This is separate from the `/notifications` namespace. Job queue updates use their own dedicated WebSocket connection.

### Queue Events

The server emits `queue-update` events with the following structure:

```typescript
interface QueueUpdatePayload {
  jobId: string;
  eventType: QueueEventType;
  progress?: number;
  stage?: string;
  message?: string;
  error?: string;
  result?: any;
  metadata?: {
    videoTitle?: string;
    videoUrl?: string;
    jobType?: string;
    [key: string]: any;
  };
}
```

### Event Types

| Event Type | Description | When It's Sent |
|------------|-------------|----------------|
| `job-queued` | Job added to queue | When `addVideoAnalysisJob()` is called |
| `job-started` | Job processing started | When job moves from pending to processing |
| `job-progress` | Job progress update | At various stages during processing (20%, 40%, 60%, 80%, 90%) |
| `job-completed` | Job finished successfully | When all analysis is complete |
| `job-failed` | Job processing failed | When an error occurs during processing |
| `job-cancelled` | Job cancelled by user | When `cancelJob()` is called |

### Progress Stages

During processing, you'll receive progress updates with descriptive stages:

**YouTube Video Processing:**
- 10% - "Job processing started"
- 20% - "Fetching video data"
- 40% - "Generating AI analysis"
- 80% - "Generating thumbnails"
- 90% - "Saving results"
- 100% - "Job completed successfully"

**File Upload Processing:**
- 10% - "Job processing started"
- 30% - "Preparing upload"
- 50% - "Transcribing audio"
- 60% - "Generating AI content"
- 90% - "Saving results"
- 100% - "Job completed successfully"

**Transcript Processing:**
- 10% - "Job processing started"
- 40% - "Summarizing transcript"
- 70% - "Generating AI analysis"
- 90% - "Saving results"
- 100% - "Job completed successfully"

## Client Implementation

### Basic Setup

```javascript
// Connect to Queue WebSocket
const socket = io('http://localhost:3000/queue', {
  auth: { token: yourJwtToken }
});

// Listen for queue updates
socket.on('queue-update', (update) => {
  console.log(`Job ${update.jobId}: ${update.message}`);
  console.log(`Progress: ${update.progress}%`);
  console.log(`Stage: ${update.stage}`);
  
  switch (update.eventType) {
    case 'job-queued':
      // Show queued UI
      break;
    case 'job-started':
      // Show processing UI
      break;
    case 'job-progress':
      // Update progress bar
      break;
    case 'job-completed':
      // Show success and results
      console.log('Results:', update.result);
      break;
    case 'job-failed':
      // Show error
      console.error('Error:', update.error);
      break;
    case 'job-cancelled':
      // Show cancelled state
      break;
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to queue updates');
});

socket.on('disconnect', () => {
  console.log('Disconnected from queue updates');
});
```

### React Example with Progress Bar

```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface QueueJob {
  jobId: string;
  progress: number;
  stage: string;
  message: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

function VideoAnalysisProgress({ jobId, token }) {
  const [job, setJob] = useState<QueueJob>({
    jobId,
    progress: 0,
    stage: 'queued',
    message: 'Waiting to start...',
    status: 'queued'
  });

  useEffect(() => {
    const socket = io('http://localhost:3000/queue', {
      auth: { token }
    });

    socket.on('queue-update', (update) => {
      if (update.jobId === jobId) {
        setJob({
          jobId: update.jobId,
          progress: update.progress || 0,
          stage: update.stage || '',
          message: update.message || '',
          status: update.eventType.replace('job-', '') as any
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId, token]);

  return (
    <div className="queue-job">
      <h3>Analysis Progress</h3>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <p>{job.stage}: {job.progress}%</p>
      <p>{job.message}</p>
      <p>Status: {job.status}</p>
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div class="queue-job">
    <h3>Analysis Progress</h3>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${job.progress}%` }"
      ></div>
    </div>
    <p>{{ job.stage }}: {{ job.progress }}%</p>
    <p>{{ job.message }}</p>
    <p>Status: {{ job.status }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

const props = defineProps(['jobId', 'token']);

const job = ref({
  jobId: props.jobId,
  progress: 0,
  stage: 'queued',
  message: 'Waiting to start...',
  status: 'queued'
});

let socket;

onMounted(() => {
  socket = io('http://localhost:3000/queue', {
    auth: { token: props.token }
  });

  socket.on('queue-update', (update) => {
    if (update.jobId === props.jobId) {
      job.value = {
        jobId: update.jobId,
        progress: update.progress || 0,
        stage: update.stage || '',
        message: update.message || '',
        status: update.eventType.replace('job-', '')
      };
    }
  });
});

onUnmounted(() => {
  if (socket) socket.disconnect();
});
</script>
```

## Benefits

1. **Real-time Feedback**: Users see progress as it happens
2. **No Polling**: Eliminates need for constant HTTP requests
3. **Better UX**: Users know exactly what's happening with their jobs
4. **Lower Server Load**: No repeated status check requests
5. **Multiple Connections**: Same user can track progress from multiple devices/tabs

## Events Flow Example

```
User submits video → 
  ↓
job-queued (0%, "Job queued at position 1")
  ↓
job-started (10%, "Job processing started")
  ↓
job-progress (20%, "Fetching video data")
  ↓
job-progress (40%, "Generating AI analysis")
  ↓
job-progress (80%, "Generating thumbnails")
  ↓
job-progress (90%, "Saving results")
  ↓
job-completed (100%, "Job completed successfully", + result data)
```

## Architecture

```
┌─────────────────┐
│  Client (Web)   │
│   Socket.io     │
└────────┬────────┘
         │
         │ WebSocket Connection
         │ (JWT Auth)
         │
┌────────▼────────────────────────┐
│  QueueGateway                   │
│  (/queue namespace)             │
│  - Independent from             │
│    notifications                │
└────────┬────────────────────────┘
         │
         │ sendQueueUpdateToUser()
         │
┌────────▼────────────────────────┐
│  DatabaseQueueService           │
│  (AuditModule)                  │
│  - Processes jobs               │
│  - Sends real-time updates      │
│  - Manages queue                │
└─────────────────────────────────┘
```

### Separation of Concerns

The system now has **two independent WebSocket namespaces**:

1. **`/notifications`** - General app notifications (NotificationGateway in NotificationModule)
   - User notifications
   - System announcements
   - Security alerts

2. **`/queue`** - Job queue updates (QueueGateway in AuditModule)
   - Video analysis progress
   - Job status changes
   - Queue position updates

This separation means:
- ✅ No circular dependencies between modules
- ✅ Each namespace can scale independently
- ✅ Clients can connect to only what they need
- ✅ Cleaner architecture and easier maintenance

## Notes

- Queue updates are sent to all connected sockets for a user
- If user is offline, updates are skipped (they can check job status via REST API)
- Progress percentages are approximate and based on processing stages
- WebSocket connection automatically reconnects on disconnect
- Same JWT token used for HTTP API works for WebSocket authentication
