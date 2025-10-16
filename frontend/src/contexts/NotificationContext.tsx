import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { websocketService } from '../lib/websocket';

interface Notification {
  id: string;
  type: 'CANDIDATE_MOVED' | 'INTERVIEW_SCHEDULED' | 'PARSING_COMPLETE' | 'TRIAL_ENDING' | 'NEW_MATCH' | 'SYSTEM_UPDATE';
  title: string;
  message: string;
  data: any;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep last 50 notifications

    // Show toast for high priority notifications
    if (notification.priority === 'high') {
      toast.success(notification.message, {
        duration: 5000,
        position: 'top-right'
      });
    } else if (notification.priority === 'medium') {
      toast(notification.message, {
        duration: 3000,
        position: 'top-right'
      });
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Set up WebSocket connection and event handling
  useEffect(() => {
    const unsubscribe = websocketService.subscribe((event) => {
      setIsConnected(websocketService.isConnected());

      // Convert WebSocket events to notifications
      let notification: Omit<Notification, 'id' | 'timestamp' | 'read'> | null = null;

      switch (event.type) {
        case 'CANDIDATE_MOVED':
          notification = {
            type: event.type,
            title: 'Candidate Moved',
            message: `${event.data.candidateName} moved to ${event.data.newStatus}`,
            data: event.data,
            priority: 'medium'
          };
          break;

        case 'INTERVIEW_SCHEDULED':
          notification = {
            type: event.type,
            title: 'Interview Scheduled',
            message: `Interview scheduled for ${event.data.candidateName} on ${event.data.date}`,
            data: event.data,
            priority: 'high'
          };
          break;

        case 'PARSING_COMPLETE':
          notification = {
            type: event.type,
            title: 'CV Parsing Complete',
            message: `CV for ${event.data.candidateName} has been processed`,
            data: event.data,
            priority: 'medium'
          };
          break;

        case 'TRIAL_ENDING':
          notification = {
            type: event.type,
            title: 'Trial Ending Soon',
            message: `Your trial ends in ${event.data.daysLeft} days`,
            data: event.data,
            priority: 'high'
          };
          break;

        case 'NEW_MATCH':
          notification = {
            type: event.type,
            title: 'New Match Found',
            message: `Found ${event.data.count} new candidates matching your criteria`,
            data: event.data,
            priority: 'medium'
          };
          break;

        case 'SYSTEM_UPDATE':
          notification = {
            type: event.type,
            title: 'System Update',
            message: event.data.message,
            data: event.data,
            priority: 'low'
          };
          break;

        default:
          console.log('Unknown notification type:', event.type);
      }

      if (notification) {
        addNotification(notification);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addNotification]);

  // Check connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(websocketService.isConnected());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    isConnected
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
