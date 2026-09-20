'use client';

import { usePushNotifications } from '@/lib/push-notifications';

export function PushNotificationsInitializer() {
  usePushNotifications();
  return null;
}