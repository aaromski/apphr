'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PushNotifications, PushNotificationSchema, PermissionStatus, PushNotificationActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { playNotificationSound } from '@/lib/notify-sound';

let initialized = false;
let cachedToken: string | null = null; // Guardamos el token recibido si la sesión aún no carga

/**
 * Initialize push notifications with Capacitor
 */
export async function initializePushNotifications(): Promise<string | null> {
  if (initialized) return cachedToken;
  if (typeof window === 'undefined') return null;
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNotifications] Not on native platform, skipping initialization');
    return null;
  }

  try {
    // Canal de alta prioridad para Android (Head-up Banner)
    await PushNotifications.createChannel({
      id: 'high_priority_notifications',
      name: 'Notificaciones Prioritarias',
      description: 'Alertas de habitaciones y SLA en tiempo real',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });

    // Request permissions
    const permStatus: PermissionStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted:', permStatus.receive);
      return null;
    }

    // Registrar listeners ANTES de llamar a register() para no perder eventos
    setupPushListeners();

    // Register with FCM
    await PushNotifications.register();

    initialized = true;
    console.log('[PushNotifications] Initialized successfully');
    
    return cachedToken;
  } catch (error) {
    console.error('[PushNotifications] Initialization error:', error);
    return null;
  }
}

/**
 * Set up all push notification listeners
 */
function setupPushListeners(): void {
  // 1. Token recibido de FCM
  PushNotifications.addListener('registration', async (token: { value: string }) => {
    console.log('[PushNotifications] Registration token:', token.value);
    cachedToken = token.value; // Guardar en caché local
    await saveFCMTokenToSupabase(token.value);
  });

  // 2. Error de registro
  PushNotifications.addListener('registrationError', (error: { error: string }) => {
    console.error('[PushNotifications] Registration error:', error.error);
  });

  // 3. Notificación recibida con App abierta (Foreground)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[PushNotifications] Received in foreground:', notification);
    
    playNotificationSound();
    
    window.dispatchEvent(new CustomEvent('pushNotificationReceived', { detail: notification }));
  });

  // 4. Tap sobre la notificación
  PushNotifications.addListener('pushNotificationActionPerformed', (action: PushNotificationActionPerformed) => {
    console.log('[PushNotifications] Action performed:', action);
    
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
      console.warn('[PushNotifications] No authenticated user yet, token cached until sign-in');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id);

    if (error) {
      console.error('[PushNotifications] Error saving FCM token:', error.message);
    } else {
      console.log('[PushNotifications] FCM token saved to Supabase for user:', user.id);
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
 * Hook para inicializar y garantizar la vinculación con el usuario cuando Inicia Sesión
 */
export function usePushNotifications() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await initializePushNotifications();
      if (mounted) {
        setIsInitialized(true);
      }
    };

    init();

    // 💡 SOLUCIÓN A LA RACE CONDITION: Escuchar el estado de autenticación de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && cachedToken) {
        console.log('[PushNotifications] Auth session detected, sync token now...');
        await saveFCMTokenToSupabase(cachedToken);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isInitialized };
}