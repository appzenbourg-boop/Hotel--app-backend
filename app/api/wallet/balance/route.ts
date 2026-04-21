import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
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

    // Find or create wallet — keyed by userId (guestId from token)
    let wallet = await prisma.wallet.findUnique({ where: { guestId } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { guestId, balance: 0 },
      });
    }

    return NextResponse.json({
      success: true,
      balance: wallet.balance,
      walletId: wallet.id,
    });
  } catch (error: any) {
    console.error('Wallet balance error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
