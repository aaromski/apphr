import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 1. Extraemos también el user_id del body (opcional)
    const { hotel_id, habitacion, mensaje, rol, user_id } = body;

    // Si viene un rol específico (ej. "limpieza"), ajustamos el mensaje por defecto o usamos el que venga
    const targetRole = rol || 'recepcion';
    
    let textMessage = mensaje;
    if (!textMessage) {
      if (targetRole === 'limpieza') {
        textMessage = `⚠️ Atención limpieza: La habitación ${habitacion} ha excedido el tiempo recomendado.`;
      } else {
        textMessage = `⚠️ Alerta de SLA excedido para la habitación ${habitacion}`;
      }
    }

    // Insertar la notificación en la base de datos de Supabase incluyendo el user_id
    // Limpiamos el user_id por si llega como texto "null" o vacío desde n8n
const cleanUserId = (!user_id || user_id === 'null' || user_id === '') ? null : user_id;

const { error } = await supabase.from('notifications').insert([
  {
    hotel_id: hotel_id || null,
    message: textMessage,
    kind: 'priority',
    unread: true,
    target_role: targetRole,
    user_id: cleanUserId, // Usamos la variable limpia
  },
]);

    if (error) {
      console.error('Error al guardar notificación en Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Alerta de SLA procesada y enviada a ${targetRole} correctamente`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}