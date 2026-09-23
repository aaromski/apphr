import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { hotel_id, habitacion, mensaje, rol, user_id } = body;
    console.log('📋 [DEBUG 1.3] Datos extraídos:', { hotel_id, habitacion, mensaje, rol, user_id });

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

    // 1. Insertar en Supabase (Esto dispara el Toast y Sonido en React vía Realtime WebSockets)
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

    console.log('🎉 [DEBUG 3] Proceso completado exitosamente');
    console.log('====================================');

    return NextResponse.json({
      success: true,
      message: `Alerta de SLA procesada y enviada a ${targetRole} correctamente`,
      data: dbData,
    });
  } catch (err: any) {
    console.error('💥 [DEBUG CRITICAL] Error no capturado en la ruta:', err);
    return NextResponse.json({ success: false, step: 'global_catch', error: err?.message || String(err) }, { status: 500 });
  }
}
