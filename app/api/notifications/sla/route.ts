import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { hotel_id, habitacion, mensaje, rol, user_id } = body;

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

    // 1. Insertar la notificación en Supabase (Dispara el Toast y Sonido en React)
    const { error: dbError } = await supabase.from('notifications').insert([
      {
        hotel_id: hotel_id || null,
        message: textMessage,
        kind: 'priority',
        unread: true,
        target_role: targetRole,
        user_id: cleanUserId,
      },
    ]);

    if (dbError) {
      console.error('Error al guardar notificación en Supabase:', dbError);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    // 2. Enviar notificación Push al teléfono vía ntfy.sh
    const ntfyTopic = process.env.NTFY_TOPIC || 'apphr-hotel-152';
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: 'POST',
        headers: {
          Title: `Alerta (${targetRole.toUpperCase()})`,
          Priority: 'urgent',
          Tags: 'warning',
        },
        body: textMessage,
      });
    } catch (ntfyErr) {
      console.error('Error no bloqueante enviando a ntfy:', ntfyErr);
    }

    return NextResponse.json({
      success: true,
      message: `Alerta de SLA procesada y enviada a ${targetRole} correctamente`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error interno' }, { status: 400 });
  }
}
