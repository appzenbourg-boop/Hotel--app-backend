import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = verifyToken(token);
  return decoded ? decoded.id : null;
}

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
    if (!guest) {
        return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const wallet = await prisma.wallet.findUnique({ where: { guestId: guest.id } });

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
