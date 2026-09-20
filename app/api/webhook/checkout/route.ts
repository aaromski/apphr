// app/api/webhook/checkout/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 400 });
    }

    // El servidor hace el fetch (Node.js no sufre restricciones de CORS del navegador)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Error en n8n: ${response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error enviando webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}