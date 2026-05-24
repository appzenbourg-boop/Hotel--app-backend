import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyToken } from '@/lib/auth';



function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = verifyToken(token);
  return decoded ? decoded.id : null;
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    
    if (!key_id || !key_secret) {
        console.error('Razorpay keys missing from .env:', { key_id: !!key_id, key_secret: !!key_secret });
        return NextResponse.json({ error: 'Payment gateway misconfigured' }, { status: 500 });
    }

    const rzp = new Razorpay({ key_id, key_secret });
    
    const { amount, currency = 'INR', notes = {} } = await request.json();

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    const options = {
      amount: Math.round(amount), // Mobile app already sends paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes,
    };

    const order = await rzp.orders.create(options);

    return NextResponse.json({
        success: true,
        order, // Return full order object as expected by mobile app
        key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    console.error('=== RAZORPAY ORDER CREATION ERROR ===');
    console.error(`Key ID Length: ${(process.env.RAZORPAY_KEY_ID || '').trim().length}`);
    console.error(`Key Secret Length: ${(process.env.RAZORPAY_KEY_SECRET || '').trim().length}`);
    console.error('Error Details:', JSON.stringify(error, null, 2));
    console.error('=======================================');
    return NextResponse.json({ success: false, error: 'Failed to create payment order', details: error?.error?.description || error.message }, { status: 500 });
  }
}
