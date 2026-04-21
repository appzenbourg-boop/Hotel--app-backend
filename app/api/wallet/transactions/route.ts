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

export async function GET(request: Request) {
  try {
    const guestId = getUserIdFromRequest(request);
    if (!guestId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const wallet = await prisma.wallet.findUnique({ where: { guestId } });

    if (!wallet) {
      return NextResponse.json({ success: true, transactions: [] });
    }

    const where: any = { walletId: wallet.id };
    if (type) where.type = type;

    const transactions = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    console.error('Wallet transactions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
