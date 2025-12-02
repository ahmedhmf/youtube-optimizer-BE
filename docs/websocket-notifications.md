# WebSocket Notification System - Complete Guide

## 🚀 Overview

The notification system now uses **WebSocket** for real-time, instant notification delivery. Users receive notifications immediately without polling.

## 🏗️ Architecture

### Backend (NestJS + Socket.IO)
- **Gateway:** `notification.gateway.ts` - WebSocket connection handler
- **Service:** `notification.service.ts` - Business logic + WebSocket integration
- **Guard:** `ws-auth.guard.ts` - WebSocket authentication

### Connection Flow
```
1. Client connects to ws://localhost:3000/notifications
2. Client sends JWT token in auth or headers
3. Server verifies token and extracts user ID
4. Server sends initial unread count + recent notifications
5. Server keeps connection open for real-time updates
6. When notification created → Server pushes to connected clients
```

## 📡 WebSocket Events

### Client → Server (Emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe-notifications` | `{}` | Subscribe to notifications |
| `mark-as-read` | `{ notificationId: string }` | Mark notification as read |
| `mark-all-as-read` | `{}` | Mark all as read |
| `get-notifications` | `{ type?, read?, limit? }` | Request notifications list |

### Server → Client (Listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `new-notification` | `{ id, title, message, type, ... }` | New notification received |
| `unread-count` | `{ count: number }` | Unread count updated |
| `initial-notifications` | `{ notifications: [] }` | Initial notifications on connect |
| `notifications-list` | `{ notifications: [], total }` | Response to get-notifications |
| `marked-as-read` | `{ notificationId: string }` | Confirmation of mark as read |
| `all-marked-as-read` | `{}` | Confirmation all marked as read |
| `system-notification` | `{ ... }` | System-wide announcement |

## 🔌 Frontend Integration

### 1. Install Socket.IO Client
```bash
npm install socket.io-client
```

### 2. React/Next.js Example

#### Create Notification Context
```typescript
// contexts/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  metadata?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode; token: string }> = ({
  children,
  token,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const socketInstance = io('http://localhost:3000/notifications', {
      auth: { token },
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Listen for unread count
    socketInstance.on('unread-count', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // Listen for initial notifications
    socketInstance.on('initial-notifications', (data: { notifications: Notification[] }) => {
      setNotifications(data.notifications);
    });

    // Listen for new notifications
    socketInstance.on('new-notification', (notification: Notification) => {
      console.log('New notification received:', notification);
      
      // Add to list
      setNotifications((prev) => [notification, ...prev]);
      
      // Show toast/snackbar
      showToast(notification.title, notification.message);
      
      // Play sound (optional)
      playNotificationSound();
    });

    // Listen for marked as read
    socketInstance.on('marked-as-read', (data: { notificationId: string }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === data.notificationId ? { ...n, read: true } : n))
      );
    });

    // Listen for all marked as read
    socketInstance.on('all-marked-as-read', () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  const markAsRead = (notificationId: string) => {
    socket?.emit('mark-as-read', { notificationId });
  };

  const markAllAsRead = () => {
    socket?.emit('mark-all-as-read', {});
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        isConnected,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Helper functions
function showToast(title: string, message: string) {
  // Use your toast library (e.g., react-hot-toast, sonner)
  console.log(`Toast: ${title} - ${message}`);
}

function playNotificationSound() {
  // Play notification sound
  const audio = new Audio('/notification-sound.mp3');
  audio.play().catch(() => console.log('Could not play sound'));
}
```

#### Notification Bell Component
```typescript
// components/NotificationBell.tsx
import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {!isConnected && (
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-gray-400 rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[600px] overflow-y-auto z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    // Navigate if actionUrl exists
                    if (notification.metadata?.actionUrl) {
                      window.location.href = notification.metadata.actionUrl;
                    }
                  }}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <a
                href="/notifications"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getNotificationIcon(type: string) {
  const icons: Record<string, string> = {
    system: '⚙️',
    processing: '⚡',
    usage: '📊',
    update: '🎉',
    tip: '💡',
    security: '🔒',
  };
  return icons[type] || '📬';
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
```

#### App Integration
```typescript
// app/layout.tsx or _app.tsx
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationBell } from './components/NotificationBell';

export default function RootLayout({ children }) {
  const token = getUserToken(); // Get JWT token from your auth system

  return (
    <html>
      <body>
        <NotificationProvider token={token}>
          <nav>
            <div>Your App</div>
            <NotificationBell />
          </nav>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
```

### 3. Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Notifications</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <div id="notifications">
    <button id="bell">
      🔔 <span id="unread-count">0</span>
    </button>
    <div id="notification-list" style="display: none;"></div>
  </div>

  <script>
    const token = 'YOUR_JWT_TOKEN';
    
    // Connect to WebSocket
    const socket = io('http://localhost:3000/notifications', {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connected to notifications');
    });

    // Listen for unread count
    socket.on('unread-count', (data) => {
      document.getElementById('unread-count').textContent = data.count;
    });

    // Listen for new notifications
    socket.on('new-notification', (notification) => {
      console.log('New notification:', notification);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon.png'
        });
      }
      
      // Update UI
      addNotificationToList(notification);
    });

    // Mark as read
    function markAsRead(notificationId) {
      socket.emit('mark-as-read', { notificationId });
    }

    function addNotificationToList(notification) {
      const list = document.getElementById('notification-list');
      const item = document.createElement('div');
      item.innerHTML = `
        <div onclick="markAsRead('${notification.id}')">
          <strong>${notification.title}</strong>
          <p>${notification.message}</p>
        </div>
      `;
      list.prepend(item);
    }

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  </script>
</body>
</html>
```

## 🔐 Authentication

### Token Format
The gateway expects JWT token in one of two ways:

1. **Auth object:**
```javascript
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'your-jwt-token' }
});
```

2. **Authorization header:**
```javascript
const socket = io('http://localhost:3000/notifications', {
  extraHeaders: {
    Authorization: 'Bearer your-jwt-token'
  }
});
```

## 🧪 Testing WebSocket

### Using Postman
1. Create new WebSocket request
2. Connect to: `ws://localhost:3000/notifications`
3. Add query param or auth: `?token=YOUR_JWT_TOKEN`
4. Send events like `mark-as-read`, `get-notifications`

### Using wscat (CLI)
```bash
npm install -g wscat
wscat -c "ws://localhost:3000/notifications" -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Socket.IO Client (Node.js)
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('new-notification', (data) => {
  console.log('Notification:', data);
});

socket.emit('get-notifications', { limit: 5 });
```

## 🔧 Backend Usage

### Sending Notifications (Automatically pushed via WebSocket)

```typescript
// In any service (e.g., database-queue.service.ts)
await this.notificationService.notifyAnalysisCompleted(userId, videoId, url);
// ✅ Notification saved to DB
// ✅ Automatically pushed to user via WebSocket (if connected)
// ✅ If user offline, they'll see it when they connect
```

### Manual WebSocket Send (Advanced)
```typescript
// Inject NotificationGateway
constructor(
  private readonly notificationGateway: NotificationGateway,
) {}

// Send to specific user
await this.notificationGateway.sendNotificationToUser(userId, {
  id: 'notif-123',
  title: 'Custom',
  message: 'Message',
  type: 'system',
});

// Broadcast to all users
await this.notificationGateway.broadcastToAll({
  title: 'Maintenance',
  message: 'System will be down at midnight',
});
```

## 📊 Monitoring

### Check Connected Users
```typescript
const connectedCount = this.notificationGateway.getConnectedUsersCount();
console.log(`${connectedCount} users connected`);

const isOnline = this.notificationGateway.isUserConnected('user-123');
console.log(`User online: ${isOnline}`);
```

## 🚨 Error Handling

### Connection Errors
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Show offline indicator
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Show offline indicator
  // Attempt reconnection
});
```

### Automatic Reconnection
Socket.IO automatically reconnects. Configure options:
```javascript
const socket = io('http://localhost:3000/notifications', {
  auth: { token },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

## 🔄 Migration from REST to WebSocket

### Before (Polling)
```javascript
// Poll every 30 seconds
setInterval(async () => {
  const response = await fetch('/notifications/unread-count');
  const { count } = await response.json();
  updateBadge(count);
}, 30000);
```

### After (WebSocket - Real-time)
```javascript
// Receive instantly
socket.on('unread-count', (data) => {
  updateBadge(data.count);
});
```

## 💡 Best Practices

1. **Connection Management**
   - Connect once when user logs in
   - Disconnect when user logs out
   - Handle reconnection automatically

2. **UI Updates**
   - Show connection status indicator
   - Display toast/snackbar for new notifications
   - Update badge count in real-time

3. **Performance**
   - Limit notifications shown in dropdown (e.g., 20 most recent)
   - Use virtual scrolling for long lists
   - Lazy load older notifications

4. **Offline Support**
   - Show offline indicator when disconnected
   - Queue actions (mark as read) when offline
   - Sync when reconnected

5. **Security**
   - Always use JWT authentication
   - Validate tokens on every connection
   - Use HTTPS/WSS in production

## 🌐 Production Configuration

### Environment Variables
```env
FRONTEND_URL=https://yourdomain.com
```

### CORS Configuration
```typescript
@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
```

### HTTPS/WSS
In production, WebSocket automatically upgrades to WSS when using HTTPS.

## 🔮 Advanced Features

### Custom Events
```typescript
// Backend
socket.emit('custom-event', { data: 'anything' });

// Frontend
socket.on('custom-event', (data) => {
  console.log(data);
});
```

### Rooms (Group Notifications)
```typescript
// Join user to their room
socket.join(`user-${userId}`);

// Send to specific room
this.server.to(`user-${userId}`).emit('notification', data);
```

### Acknowledgments
```typescript
// Frontend - wait for confirmation
socket.emit('mark-as-read', { notificationId }, (response) => {
  console.log('Acknowledged:', response);
});

// Backend - send acknowledgment
@SubscribeMessage('mark-as-read')
async handleMarkAsRead(@MessageBody() data, @ConnectedSocket() client) {
  // ... process ...
  return { success: true }; // Sent back to client
}
```

## 📖 Summary

✅ **Real-time notifications** - No polling, instant delivery  
✅ **Automatic fallback** - If user offline, saved in DB  
✅ **JWT authentication** - Secure WebSocket connections  
✅ **Multiple connections** - User can be connected from multiple devices  
✅ **Event-driven** - Clean, reactive architecture  
✅ **Production-ready** - CORS, error handling, reconnection  

The WebSocket implementation provides a superior user experience with instant notifications while maintaining backward compatibility with the REST API.
