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

    const key_id = process.env.RAZORPAY_KEY_ID || '';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || '';
    
    if (!key_id || !key_secret) {
        console.error('Razorpay keys missing from .env');
        return NextResponse.json({ error: 'Payment gateway misconfigured' }, { status: 500 });
    }

    const rzp = new Razorpay({ key_id, key_secret });
    
    const { amount, currency = 'INR', notes = {} } = await request.json();

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    // Create mandate order with recurring payment options
    const options = {
      amount: Math.round(amount * 100), // convert to paise
      currency,
      receipt: `mandate_${Date.now()}`,
      notes: {
        ...notes,
        mandate_type: 'recurring'
      },
    };

    const order = await rzp.orders.create(options);

    return NextResponse.json({
        success: true,
        orderId: order.id,
        key: process.env.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency
    });
  } catch (error: any) {
    console.error('Razorpay Mandate Error:', error);
    return NextResponse.json({ error: 'Failed to create mandate order' }, { status: 500 });
  }
}
