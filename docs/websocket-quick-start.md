# WebSocket Notifications - Quick Start

## 🚀 Quick Setup (5 Minutes)

### Backend (Already Done ✅)
The WebSocket gateway is automatically configured and running on the `/notifications` namespace.

### Frontend Setup

#### 1. Install Socket.IO Client
```bash
npm install socket.io-client
```

#### 2. Connect to WebSocket
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: { token: yourJWTToken },
  transports: ['websocket']
});
```

#### 3. Listen for Notifications
```typescript
// Connection status
socket.on('connect', () => console.log('Connected!'));

// Unread count
socket.on('unread-count', (data) => {
  console.log('Unread:', data.count);
  // Update UI badge
});

// New notification
socket.on('new-notification', (notification) => {
  console.log('New:', notification);
  // Show toast/snackbar
  // Play sound
  // Update notification list
});
```

#### 4. Mark as Read
```typescript
socket.emit('mark-as-read', { notificationId: 'uuid' });
```

## 📡 All Events

### Listen (Server → Client)
```typescript
socket.on('new-notification', (data) => {});      // New notification
socket.on('unread-count', (data) => {});          // Unread count
socket.on('initial-notifications', (data) => {}); // On connect
socket.on('notifications-list', (data) => {});    // List response
socket.on('marked-as-read', (data) => {});        // Read confirmation
socket.on('all-marked-as-read', () => {});        // All read confirmation
```

### Emit (Client → Server)
```typescript
socket.emit('subscribe-notifications', {});
socket.emit('mark-as-read', { notificationId });
socket.emit('mark-all-as-read', {});
socket.emit('get-notifications', { type, read, limit });
```

## 🎯 React Example

```typescript
// useNotifications.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useNotifications(token: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io('http://localhost:3000/notifications', {
      auth: { token },
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('unread-count', (data) => setUnreadCount(data.count));
    
    socket.on('new-notification', (notification) => {
      // Show toast
      toast.success(notification.title, {
        description: notification.message,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const markAsRead = (id: string) => {
    socket.emit('mark-as-read', { notificationId: id });
  };

  return { unreadCount, isConnected, markAsRead };
}

// Component
function NotificationBell() {
  const { unreadCount, isConnected, markAsRead } = useNotifications(token);

  return (
    <div>
      🔔 {unreadCount}
      {!isConnected && <span>⚠️ Offline</span>}
    </div>
  );
}
```

## 🧪 Test Connection

### Using Browser Console
```javascript
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('✅ Connected'));
socket.on('unread-count', (data) => console.log('Unread:', data.count));
socket.on('new-notification', (n) => console.log('New:', n));
```

### Using Node.js
```bash
npm install socket.io-client
node
```

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('new-notification', (n) => console.log(n));
```

## 🔐 Authentication

### Option 1: Auth Object (Recommended)
```typescript
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'your-jwt-token' }
});
```

### Option 2: Authorization Header
```typescript
const socket = io('http://localhost:3000/notifications', {
  extraHeaders: {
    Authorization: 'Bearer your-jwt-token'
  }
});
```

## 🎨 UI Examples

### Notification Badge
```tsx
function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}
```

### Toast Notification
```typescript
socket.on('new-notification', (notification) => {
  // Using react-hot-toast
  toast.custom((t) => (
    <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
      <span className="text-2xl">{getIcon(notification.type)}</span>
      <div>
        <p className="font-medium">{notification.title}</p>
        <p className="text-sm text-gray-600">{notification.message}</p>
      </div>
      <button onClick={() => toast.dismiss(t.id)}>✕</button>
    </div>
  ));
});
```

### Connection Indicator
```tsx
function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="text-xs">{isConnected ? 'Live' : 'Offline'}</span>
    </div>
  );
}
```

## 🚨 Error Handling

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Show offline message
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Show reconnecting message
});

socket.io.on('reconnect', (attempt) => {
  console.log('Reconnected after', attempt, 'attempts');
  // Hide offline message
});
```

## 🌐 Production Setup

### Environment Variables
```env
# .env
FRONTEND_URL=https://yourdomain.com
```

### Frontend Connection
```typescript
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const socket = io(`${SOCKET_URL}/notifications`, {
  auth: { token },
});
```

## ⚡ Performance Tips

1. **Single Connection** - Connect once, reuse everywhere
2. **Cleanup** - Always disconnect on unmount
3. **Debounce** - Debounce frequent events
4. **Limit Listeners** - Remove unused event listeners

```typescript
useEffect(() => {
  const socket = io(...);
  
  socket.on('event', handler);
  
  return () => {
    socket.off('event', handler); // Remove listener
    socket.disconnect(); // Disconnect
  };
}, []);
```

## 📊 Monitoring

### Backend
```typescript
// In any service
const connectedUsers = this.notificationGateway.getConnectedUsersCount();
console.log(`${connectedUsers} users connected`);
```

### Frontend
```typescript
socket.on('connect', () => {
  console.log('Socket ID:', socket.id);
  console.log('Connected:', socket.connected);
});
```

## 🔄 Migration from REST

### Before (Polling every 30s)
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch('/notifications/unread-count');
    const { count } = await res.json();
    setUnreadCount(count);
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

### After (Real-time WebSocket)
```typescript
useEffect(() => {
  const socket = io('http://localhost:3000/notifications', {
    auth: { token }
  });
  
  socket.on('unread-count', (data) => {
    setUnreadCount(data.count);
  });
  
  return () => socket.disconnect();
}, [token]);
```

**Benefits:**
- ✅ Instant updates (no 30s delay)
- ✅ No unnecessary API calls
- ✅ Lower server load
- ✅ Better user experience

## 🎯 Complete Example

```typescript
// NotificationProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, token }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const s = io('http://localhost:3000/notifications', {
      auth: { token }
    });

    s.on('connect', () => console.log('🔌 Connected'));
    s.on('unread-count', (data) => setUnreadCount(data.count));
    s.on('new-notification', (n) => {
      toast.success(n.title, { description: n.message });
      playSound();
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  const markAsRead = (id: string) => {
    socket?.emit('mark-as-read', { notificationId: id });
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

function playSound() {
  new Audio('/notification.mp3').play().catch(() => {});
}
```

## 📖 Full Documentation

For complete documentation, see:
- **Full Guide:** `docs/websocket-notifications.md`
- **REST API:** `docs/notification-quick-reference.md`
- **Setup:** `docs/NOTIFICATION-SETUP-CHECKLIST.md`

## ✅ Checklist

- [ ] Install socket.io-client
- [ ] Create WebSocket connection with JWT token
- [ ] Listen for `new-notification` event
- [ ] Listen for `unread-count` event
- [ ] Handle connection/disconnection
- [ ] Show toast for new notifications
- [ ] Update badge count
- [ ] Implement mark as read
- [ ] Add connection status indicator
- [ ] Test with real notifications

🎉 **You're ready to use real-time notifications!**
