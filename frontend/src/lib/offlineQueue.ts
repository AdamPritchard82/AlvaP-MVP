// Offline Queue Manager for AlvaP PWA
interface QueuedAction {
  id: string;
  type: 'CREATE_CANDIDATE' | 'UPLOAD_CV';
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private isOnline: boolean = navigator.onLine;
  private processing: boolean = false;

  constructor() {
    this.loadFromStorage();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('alvap-offline-queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('alvap-offline-queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  addAction(type: QueuedAction['type'], data: any): string {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const action: QueuedAction = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3
    };

    this.queue.push(action);
    this.saveToStorage();

    if (this.isOnline) {
      this.processQueue();
    }

    return id;
  }

  async processQueue() {
    if (this.processing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`Processing ${this.queue.length} queued actions...`);

    const actionsToProcess = [...this.queue];
    
    for (const action of actionsToProcess) {
      try {
        await this.processAction(action);
        this.removeAction(action.id);
      } catch (error) {
        console.error(`Failed to process action ${action.id}:`, error);
        action.retries++;
        
        if (action.retries >= action.maxRetries) {
          console.error(`Action ${action.id} failed after ${action.maxRetries} retries, removing from queue`);
          this.removeAction(action.id);
        } else {
          // Update the action in the queue
          const index = this.queue.findIndex(a => a.id === action.id);
          if (index !== -1) {
            this.queue[index] = action;
            this.saveToStorage();
          }
        }
      }
    }

    this.processing = false;
  }

  private async processAction(action: QueuedAction) {
    const { api } = await import('./api');
    
    switch (action.type) {
      case 'CREATE_CANDIDATE':
        const result = await api.createCandidate(action.data);
        if (!result.success) {
          throw new Error(result.message || 'Failed to create candidate');
        }
        console.log('Successfully created candidate:', result);
        break;

      case 'UPLOAD_CV':
        const parseResult = await api.parseCV(action.data.file);
        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Failed to parse CV');
        }
        
        const candidateData = {
          full_name: parseResult.data.full_name || 'Unknown',
          email: parseResult.data.email || '',
          phone: parseResult.data.phone || '',
          current_title: parseResult.data.current_title || '',
          current_employer: parseResult.data.current_employer || '',
          salary_min: parseResult.data.salary_min || null,
          salary_max: parseResult.data.salary_max || null,
          skills: parseResult.data.skills || {
            communications: false,
            campaigns: false,
            policy: false,
            publicAffairs: false
          },
          tags: parseResult.data.tags || [],
          notes: `CV uploaded offline - Parser: ${parseResult.parserUsed || 'Unknown'}`
        };

        const createResult = await api.createCandidate(candidateData);
        if (!createResult.success) {
          throw new Error(createResult.message || 'Failed to create candidate from CV');
        }
        console.log('Successfully processed CV upload:', createResult);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private removeAction(id: string) {
    this.queue = this.queue.filter(action => action.id !== id);
    this.saveToStorage();
  }

  getQueueStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      processing: this.processing,
      actions: this.queue.map(action => ({
        id: action.id,
        type: action.type,
        timestamp: action.timestamp,
        retries: action.retries,
        maxRetries: action.maxRetries
      }))
    };
  }

  clearQueue() {
    this.queue = [];
    this.saveToStorage();
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
export default offlineQueue;
