// WebSocket service for real-time notifications
interface NotificationEvent {
  type: 'CANDIDATE_MOVED' | 'INTERVIEW_SCHEDULED' | 'PARSING_COMPLETE' | 'TRIAL_ENDING' | 'NEW_MATCH' | 'SYSTEM_UPDATE';
  data: any;
  timestamp: number;
  id: string;
}

interface WebSocketService {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  subscribe: (callback: (event: NotificationEvent) => void) => () => void;
  sendMessage: (message: any) => void;
}

class WebSocketManager implements WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Set<(event: NotificationEvent) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      // Use wss:// for production, ws:// for development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifySubscribers({
          type: 'SYSTEM_UPDATE',
          data: { message: 'Connected to real-time updates' },
          timestamp: Date.now(),
          id: `system_${Date.now()}`
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const notification: NotificationEvent = JSON.parse(event.data);
          this.notifySubscribers(notification);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
  }

  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  subscribe(callback: (event: NotificationEvent) => void) {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(event: NotificationEvent) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }

  sendMessage(message: any) {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketManager();
export default websocketService;
