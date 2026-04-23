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

// Resolve guest — added self-healing to auto-create missing records
async function resolveGuest(userId: string) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { id: true, name: true, phone: true, email: true } 
  });
  
  if (user) {
    let guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: user.name,
          phone: user.phone,
          email: user.email,
          checkInStatus: 'PENDING',
          referralCode: `${user.name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
        }
      });
      await prisma.wallet.upsert({
        where: { guestId: guest.id },
        update: {},
        create: { guestId: guest.id, balance: 0 }
      });
    }
    return guest;
  }
  return await prisma.guest.findUnique({ where: { id: userId } });
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const guest = await resolveGuest(userId);
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
