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

    const { amount, reason } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({ where: { guestId } });

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 });
    }

    if (wallet.balance < amount) {
      return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 });
    }

    const updatedWallet = await prisma.wallet.update({
      where: { guestId },
      data: { balance: { decrement: amount } },
    });

    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount,
        description: reason || 'Payment deducted',
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: updatedWallet.balance,
      transactionId: transaction.id,
    });
  } catch (error: any) {
    console.error('Deduct money error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
