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

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const guest = await resolveGuest(userId);
    if (!guest) {
        return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    }

    let { amount } = await request.json();
    console.log('[AddMoney] Received amount:', amount, 'type:', typeof amount);
    
    // Ensure amount is a number
    amount = parseFloat(amount as any);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { guestId: guest.id } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { guestId: guest.id, balance: amount },
      });
    } else {
      wallet = await prisma.wallet.update({
        where: { guestId: guest.id },
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
