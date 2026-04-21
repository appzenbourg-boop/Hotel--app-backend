import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const guestId = getUserIdFromRequest(request);
    if (!guestId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { guestId } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { guestId, balance: amount },
      });
    } else {
      wallet = await prisma.wallet.update({
        where: { guestId },
        data: { balance: { increment: amount } },
      });
    }

    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: 'Money added to wallet',
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: wallet.balance,
      transactionId: transaction.id,
    });
  } catch (error: any) {
    console.error('Add money error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
