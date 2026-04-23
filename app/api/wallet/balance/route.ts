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
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve guest
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    let guest = null;
    if (user) {
      guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    }
    if (!guest) guest = await prisma.guest.findUnique({ where: { id: userId } });
    
    if (!guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });

    // Find or create wallet — keyed by guestId
    let wallet = await prisma.wallet.findUnique({ where: { guestId: guest.id } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { guestId: guest.id, balance: 0 },
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
