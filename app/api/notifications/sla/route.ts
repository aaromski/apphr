import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendFirebasePushNotification(fcmToken: string, title: string, bodyText: string) {
  const firebaseServerKey = process.env.FIREBASE_SERVER_KEY;
  console.log('--- [DEBUG 3] Intentando enviar FCM ---');
  console.log('Firebase Server Key presente:', !!firebaseServerKey);
  console.log('FCM Token:', fcmToken);

  if (!firebaseServerKey || !fcmToken) {
    console.log('⚠️ [DEBUG 3.1] Omite FCM por falta de API Key o Token');
    return;
  }

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${firebaseServerKey}`,
      },
      body: JSON.stringify({
        to: fcmToken,
        priority: 'high',
        content_available: true,
        time_to_live: 0,
        notification: { title, body: bodyText, sound: 'default', channel_id: 'high_priority_notifications' },
        data: { title, body: bodyText, channel_id: 'high_priority_notifications', sound: 'default', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        android: { priority: 'high', ttl: '0s' },
      }),
    });
    console.log('✅ [DEBUG 3.2] Respuesta de FCM status:', res.status);
  } catch (fcmError) {
    console.error('❌ [DEBUG 3.3] Error en FCM:', fcmError);
  }
}

export async function POST(request: Request) {
  console.log('====================================');
  console.log('🚀 [DEBUG 1] Petición recibida en /api/notifications/sla');

  try {
    const rawText = await request.text();
    console.log('📦 [DEBUG 1.1] Body bruto recibido:', rawText);

    let body: any = {};
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch (pErr) {
        console.error('❌ [DEBUG 1.2] Error parseando JSON:', pErr);
      }
    }

    const { hotel_id, habitacion, mensaje, rol, user_id, fcm_token } = body;
    console.log('📋 [DEBUG 1.3] Datos extraídos:', { hotel_id, habitacion, mensaje, rol, user_id, fcm_token });

    const targetRole = rol || 'recepcion';
    let textMessage = mensaje;
    if (!textMessage) {
      if (targetRole === 'limpieza') {
        textMessage = `⚠️ Atención limpieza: La habitación ${habitacion || 'N/A'} ha excedido el tiempo recomendado.`;
      } else {
        textMessage = `⚠️ Alerta de SLA excedido para la habitación ${habitacion || 'N/A'}`;
      }
    }

    const cleanUserId = (!user_id || user_id === 'null' || user_id === '') ? null : user_id;

    // 1. Insertar en Supabase
    console.log('💾 [DEBUG 2] Insertando en Supabase...');
    const { data: dbData, error } = await supabase.from('notifications').insert([
      {
        hotel_id: hotel_id || null,
        message: textMessage,
        kind: 'priority',
        unread: true,
        target_role: targetRole,
        user_id: cleanUserId,
      },
    ]).select();

    if (error) {
      console.error('❌ [DEBUG 2.1] Error en Supabase insert:', error);
      return NextResponse.json({ success: false, step: 'supabase_insert', error: error.message }, { status: 500 });
    }
    console.log('✅ [DEBUG 2.2] Insert exitoso en Supabase:', dbData);

    // 2. Token FCM
    let targetFcmToken = fcm_token;
    if (!targetFcmToken && cleanUserId) {
      console.log('🔍 [DEBUG 2.3] Buscando FCM Token en profiles para user_id:', cleanUserId);
      const { data: profile } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', cleanUserId)
        .single();

      if (profile?.fcm_token) {
        targetFcmToken = profile.fcm_token;
      }
    }

    // 3. Notificación Push
    if (targetFcmToken) {
      await sendFirebasePushNotification(
        targetFcmToken,
        `Alerta (${targetRole.toUpperCase()})`,
        textMessage
      );
    } else {
      console.log('ℹ️ [DEBUG 3.4] No hay FCM Token para enviar Push');
    }

    console.log('🎉 [DEBUG 4] Proceso completado exitosamente');
    console.log('====================================');

    return NextResponse.json({
      success: true,
      message: `Alerta de SLA procesada y enviada a ${targetRole} correctamente`,
    });
  } catch (err: any) {
    console.error('💥 [DEBUG CRITICAL] Error no capturado en la ruta:', err);
    return NextResponse.json({ success: false, step: 'global_catch', error: err?.message || String(err) }, { status: 500 });
  }
}
