import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDsB8yZWCz6m7ruuTPL0zzeVPES53ssY6U",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "apphr-ab6fa.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'apphr-ab6fa',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "apphr-ab6fa.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '417516065136',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:417516065136:web:51881016d1e0d81a79bfb5",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-6JFMM4RHZD"
};

// Inicializar la app de Firebase (evita re-inicializar si ya existe una instancia)
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Función helper para obtener la instancia de Messaging solo si el navegador la soporta
export const getFcmMessaging = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(firebaseApp);
  }
  return null;
};