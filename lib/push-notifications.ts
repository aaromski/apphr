'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PushNotifications, PushNotificationSchema, PermissionStatus, PushNotificationActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { playNotificationSound } from '@/lib/notify-sound';

let initialized = false;

/**
 * Initialize push notifications with Capacitor
 * Requests permissions, registers with FCM, and sets up listeners
 */
export async function initializePushNotifications(): Promise<string | null> {
  if (initialized) return null;
  if (typeof window === 'undefined') return null;
  
  // Only run on Capacitor (native) platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNotifications] Not on native platform, skipping initialization');
    return null;
  }

  try {
    // Request permissions
    const permStatus: PermissionStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted:', permStatus.receive);
      return null;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Set up listeners
    setupPushListeners();

    initialized = true;
    console.log('[PushNotifications] Initialized successfully');
    
    // Return current token if available
    return getFCMToken();
  } catch (error) {
    console.error('[PushNotifications] Initialization error:', error);
    return null;
  }
}

/**
 * Get the current FCM token from Capacitor
 */
function getFCMToken(): string | null {
  // Token is stored in the listener, we'll get it from the registration event
  // This is a placeholder - actual token comes via listener
  return null;
}

/**
 * Set up all push notification listeners
 */
function setupPushListeners(): void {
  // 1. Registration - token received
  PushNotifications.addListener('registration', async (token: { value: string }) => {
    console.log('[PushNotifications] Registration token:', token.value);
    await saveFCMTokenToSupabase(token.value);
  });

  // 2. Registration error
  PushNotifications.addListener('registrationError', (error: { error: string }) => {
    console.error('[PushNotifications] Registration error:', error.error);
  });

  // 3. Push notification received (app in foreground)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[PushNotifications] Received in foreground:', notification);
    
    // Play local sound for foreground notifications
    playNotificationSound();
    
    // Optional: Show in-app notification banner
    // You can emit a custom event or use a state management solution
    window.dispatchEvent(new CustomEvent('pushNotificationReceived', { detail: notification }));
  });

  // 4. Push notification action performed (user tapped notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: PushNotificationActionPerformed) => {
    console.log('[PushNotifications] Action performed:', action);
    
    // Handle navigation based on notification data
    const data = action.notification.data;
    if (data?.route) {
      window.location.href = data.route;
    }
  });
}

/**
 * Save FCM token to Supabase profiles table
 */
async function saveFCMTokenToSupabase(token: string): Promise<void> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.warn('[PushNotifications] No authenticated user, token not saved');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id);

    if (error) {
      console.error('[PushNotifications] Error saving FCM token:', error.message);
    } else {
      console.log('[PushNotifications] FCM token saved to Supabase');
    }
  } catch (error) {
    console.error('[PushNotifications] Unexpected error saving token:', error);
  }
}

/**
 * Clear FCM token from Supabase on sign out
 */
export async function clearFCMTokenOnSignOut(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: null })
      .eq('id', user.id);

    if (error) {
      console.error('[PushNotifications] Error clearing FCM token:', error.message);
    } else {
      console.log('[PushNotifications] FCM token cleared on sign out');
    }
  } catch (error) {
    console.error('[PushNotifications] Unexpected error clearing token:', error);
  }
}

/**
 * Hook to initialize push notifications on app mount
 * Usage: const { isInitialized } = usePushNotifications();
 */
export function usePushNotifications() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const token = await initializePushNotifications();
      if (mounted) {
        setIsInitialized(true);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { isInitialized };
}