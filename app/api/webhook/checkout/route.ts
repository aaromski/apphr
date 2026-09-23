// app/api/webhook/checkout/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let body: any = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn('Checkout webhook URL not configured; skipping external dispatch.');
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'Webhook URL not configured',
      }, { status: 200 });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        evento: body?.evento || 'check_out',
        timestamp: body?.timestamp || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn(`Checkout webhook responded with ${response.status}: ${response.statusText}`);
      return NextResponse.json({
        success: false,
        skipped: false,
        message: `Webhook returned ${response.status}`,
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, skipped: false });
  } catch (err: any) {
    console.error('Error enviando webhook:', err);
    return NextResponse.json({
      success: false,
      skipped: true,
      message: err?.message || 'Unknown checkout webhook error',
    }, { status: 200 });
  }
}