importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDsB8yZWCz6m7ruuTPL0zzeVPES53ssY6U",
  authDomain: "apphr-ab6fa.firebaseapp.com",
  projectId: "apphr-ab6fa",
  storageBucket: "apphr-ab6fa.firebasestorage.app",
  messagingSenderId: "417516065136",
  appId: "1:417516065136:web:51881016d1e0d81a79bfb5",
  measurementId: "G-6JFMM4RHZD"
});

const messaging = firebase.messaging();

// Captura las notificaciones cuando la app está en segundo plano o cerrada
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación recibida en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || '🧹 Nueva Alerta AppHR';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una tarea de limpieza asignada.',
    icon: '/icon.png',
    badge: '/badge.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});