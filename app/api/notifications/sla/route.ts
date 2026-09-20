// app/api/notifications/sla/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Extraemos los datos que envía n8n
    const { hotel_id, room_number, sla_min } = body;

    if (!room_number) {
      return NextResponse.json({ error: 'Faltan datos de la habitación' }, { status: 400 });
    }

    // Aquí puedes manejar la lógica que prefieras:
    // - Guardar en tu sistema de logs/notificaciones si lo requieres.
    // - O simplemente confirmar la recepción para que n8n dé el flujo por exitoso.
    console.log(`⚠️ Alerta de SLA superado recibida desde n8n para la habitación ${room_number}`);

    return NextResponse.json({ 
      success: true, 
      message: `Notificación procesada para la habitación ${room_number}` 
    });
  } catch (err: any) {
    console.error('Error procesando la notificación de SLA:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}