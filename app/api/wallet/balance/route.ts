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
    if (!guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { guestId: guest.id } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { guestId: guest.id, balance: 0 },
      });
    }

    // --- SELF-HEALING LOGIC ---
    // Recalculate balance from transactions to be 100% sure
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id }
    });

    let calculatedBalance = 0;
    transactions.forEach(tx => {
      if (tx.type === 'CREDIT') calculatedBalance += tx.amount;
      else if (tx.type === 'DEBIT') calculatedBalance -= tx.amount;
    });

    // If there is a mismatch, update the wallet balance field
    if (Math.abs(wallet.balance - calculatedBalance) > 0.01) {
      console.log(`[Wallet] Fixing balance mismatch. DB: ${wallet.balance}, Ledger: ${calculatedBalance}`);
      wallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: calculatedBalance }
      });
    }

    return NextResponse.json({
      success: true,
      balance: wallet.balance,
      walletId: wallet.id,
      guestId: guest.id,
      userId: userId
    });
  } catch (error: any) {
    console.error('Wallet balance error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
