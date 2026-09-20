// app/api/notifications/sla/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Extraemos los datos enviados por n8n
    const { hotel_id, room_number, sla_min } = body;

    console.log(`⚠️ Alerta de SLA recibida desde n8n para la habitación: ${room_number || 'Desconocida'}`);

    return NextResponse.json({ 
      success: true, 
      message: `Alerta de SLA procesada correctamente para la habitación ${room_number || 'N/A'}` 
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error procesando la notificación de SLA:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

// Opcional: Para permitir que si abres la URL por error en el navegador no dé 404 feo
export async function GET() {
  return NextResponse.json({ 
    status: "Active", 
    endpoint: "AppHR SLA Notifications API" 
  }, { status: 200 });
}
