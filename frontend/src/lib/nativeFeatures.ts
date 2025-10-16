// Native mobile features using Capacitor
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

export class NativeFeatures {
  private static isNative = Capacitor.isNativePlatform();

  // Push Notifications
  static async requestPushPermissions(): Promise<boolean> {
    if (!this.isNative) return false;
    
    try {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch (error) {
      console.error('Failed to request push permissions:', error);
      return false;
    }
  }

  static async registerForPushNotifications(): Promise<string | null> {
    if (!this.isNative) return null;
    
    try {
      await PushNotifications.register();
      
      // Listen for registration success
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        return token.value;
      });
      
      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        return null;
      });
      
      // Listen for push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        this.triggerHapticFeedback();
      });
      
      // Listen for push notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed:', notification);
        this.triggerHapticFeedback();
      });
      
      return null; // Token will be returned via listener
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  // Biometric Authentication (using device info for now)
  static async isBiometricAvailable(): Promise<boolean> {
    if (!this.isNative) return false;
    
    try {
      const info = await Device.getInfo();
      // Check if device supports biometric authentication
      return info.platform === 'ios' || info.platform === 'android';
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return false;
    }
  }

  static async authenticateWithBiometric(): Promise<boolean> {
    if (!this.isNative) return false;
    
    try {
      // For now, we'll use a simple prompt
      // In a real app, you'd use @capacitor/local-authentication
      const confirmed = confirm('Use biometric authentication to unlock AlvaP?');
      if (confirmed) {
        this.triggerHapticFeedback();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  // Share Sheet Integration
  static async shareCandidate(candidate: {
    name: string;
    title: string;
    email: string;
    phone?: string;
    oneLiner?: string;
  }): Promise<boolean> {
    if (!this.isNative) {
      // Fallback to Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Candidate: ${candidate.name}`,
            text: candidate.oneLiner || `${candidate.name} - ${candidate.title}`,
            url: window.location.href
          });
          return true;
        } catch (error) {
          console.error('Web share failed:', error);
          return false;
        }
      }
      return false;
    }
    
    try {
      await Share.share({
        title: `Candidate: ${candidate.name}`,
        text: candidate.oneLiner || `${candidate.name} - ${candidate.title}\nEmail: ${candidate.email}${candidate.phone ? `\nPhone: ${candidate.phone}` : ''}`,
        url: window.location.href
      });
      this.triggerHapticFeedback();
      return true;
    } catch (error) {
      console.error('Share failed:', error);
      return false;
    }
  }

  static async shareCV(file: File): Promise<boolean> {
    if (!this.isNative) return false;
    
    try {
      // Convert file to base64 for sharing
      const base64 = await this.fileToBase64(file);
      await Share.share({
        title: `CV: ${file.name}`,
        text: `Sharing CV: ${file.name}`,
        url: `data:${file.type};base64,${base64}`
      });
      this.triggerHapticFeedback();
      return true;
    } catch (error) {
      console.error('CV share failed:', error);
      return false;
    }
  }

  // Haptic Feedback
  static async triggerHapticFeedback(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
    if (!this.isNative) return;
    
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  static async triggerNotificationHaptic(): Promise<void> {
    if (!this.isNative) return;
    
    try {
      await Haptics.notification({ type: 'success' });
    } catch (error) {
      console.error('Notification haptic failed:', error);
    }
  }

  // App State Management
  static async getAppState(): Promise<string> {
    if (!this.isNative) return 'active';
    
    try {
      const state = await App.getState();
      return state.isActive ? 'active' : 'background';
    } catch (error) {
      console.error('Failed to get app state:', error);
      return 'unknown';
    }
  }

  static onAppStateChange(callback: (state: string) => void): void {
    if (!this.isNative) return;
    
    App.addListener('appStateChange', ({ isActive }) => {
      callback(isActive ? 'active' : 'background');
    });
  }

  // Device Information
  static async getDeviceInfo(): Promise<{
    platform: string;
    model: string;
    osVersion: string;
    isNative: boolean;
  }> {
    if (!this.isNative) {
      return {
        platform: 'web',
        model: 'browser',
        osVersion: navigator.userAgent,
        isNative: false
      };
    }
    
    try {
      const info = await Device.getInfo();
      return {
        platform: info.platform,
        model: info.model,
        osVersion: info.osVersion,
        isNative: true
      };
    } catch (error) {
      console.error('Failed to get device info:', error);
      return {
        platform: 'unknown',
        model: 'unknown',
        osVersion: 'unknown',
        isNative: true
      };
    }
  }

  // Utility Functions
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:type;base64, prefix
      };
      reader.onerror = error => reject(error);
    });
  }

  // Initialize all native features
  static async initialize(): Promise<void> {
    if (!this.isNative) {
      console.log('Running in web mode - native features disabled');
      return;
    }

    console.log('Initializing native features...');
    
    try {
      // Request push notification permissions
      const pushEnabled = await this.requestPushPermissions();
      if (pushEnabled) {
        await this.registerForPushNotifications();
      }
      
      // Set up app state monitoring
      this.onAppStateChange((state) => {
        console.log('App state changed:', state);
        if (state === 'active') {
          this.triggerHapticFeedback();
        }
      });
      
      console.log('Native features initialized successfully');
    } catch (error) {
      console.error('Failed to initialize native features:', error);
    }
  }
}

export default NativeFeatures;
