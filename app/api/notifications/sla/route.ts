import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Envía la notificación Push directamente a los servidores de Firebase FCM
 */
/**
 * Envía la notificación Push directamente a los servidores de Firebase FCM
 */
async function sendFirebasePushNotification(fcmToken: string, title: string, bodyText: string) {
  const firebaseServerKey = process.env.FIREBASE_SERVER_KEY;

  if (!firebaseServerKey || !fcmToken) return;

  try {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${firebaseServerKey}`,
      },
      body: JSON.stringify({
        to: fcmToken,
        priority: 'high', // Prioridad máxima de entrega en FCM
        content_available: true, // Notifica al SO en segundo plano
        time_to_live: 0, // Entrega inmediata sin encolar
        // Android muestra este bloque aunque la app este minimizada o la pantalla apagada.
        notification: {
          title,
          body: bodyText,
          sound: 'default',
          channel_id: 'high_priority_notifications',
        },
        data: {
          title: title,
          body: bodyText,
          channel_id: 'high_priority_notifications',
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: {
          priority: 'high',
          ttl: '0s',
        },
      }),
    });
  } catch (fcmError) {
    console.error('Error enviando Push vía Firebase:', fcmError);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Extraemos también fcm_token por si viene directo desde n8n/webhook
    const { hotel_id, habitacion, mensaje, rol, user_id, fcm_token } = body;

    const targetRole = rol || 'recepcion';
    
    let textMessage = mensaje;
    if (!textMessage) {
      if (targetRole === 'limpieza') {
        textMessage = `⚠️ Atención limpieza: La habitación ${habitacion} ha excedido el tiempo recomendado.`;
      } else {
        textMessage = `⚠️ Alerta de SLA excedido para la habitación ${habitacion}`;
      }
    }

    const cleanUserId = (!user_id || user_id === 'null' || user_id === '') ? null : user_id;

    // 1. Insertar la notificación en Supabase
    const { error } = await supabase.from('notifications').insert([
      {
        hotel_id: hotel_id || null,
        message: textMessage,
        kind: 'priority',
        unread: true,
        target_role: targetRole,
        user_id: cleanUserId,
      },
    ]);

    if (error) {
      console.error('Error al guardar notificación en Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 2. Obtener el token FCM para el envío Push
    let targetFcmToken = fcm_token;

    // Si no vino directo en el body, lo buscamos en la tabla profiles con el user_id
    if (!targetFcmToken && cleanUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', cleanUserId)
        .single();

      if (profile?.fcm_token) {
        targetFcmToken = profile.fcm_token;
      }
    }

    // 3. Disparar la notificación flotante si se encontró un token válido
    if (targetFcmToken) {
      await sendFirebasePushNotification(
        targetFcmToken,
        `Alerta (${targetRole.toUpperCase()})`,
        textMessage
      );
    }

    return NextResponse.json({
      success: true,
      message: `Alerta de SLA procesada y enviada a ${targetRole} correctamente`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}