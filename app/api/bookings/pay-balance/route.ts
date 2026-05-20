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

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bookingId, amount, useWallet } = body;

    if (!bookingId || !amount) {
      return NextResponse.json({ error: 'bookingId and amount are required' }, { status: 400 });
    }

    const guest = await prisma.guest.findUnique({
      where: { phone: (await prisma.user.findUnique({ where: { id: userId } }))?.phone || '' }
    });
    // Fallback if not found by phone
    const activeGuestId = guest ? guest.id : userId;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, guestId: activeGuestId },
    });

    if (!booking) return NextResponse.json({ error: 'Booking not found or Ownership mismatch' }, { status: 404 });

    // Transactional execution of deduction & payment logging
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { guestId: booking.guestId } });
      if (!wallet || wallet.balance < amount) {
        throw new Error('Insufficient wallet balance. Please recharge wallet.');
      }

      // 1. Debit Wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: amount,
          description: `Cleared outstanding balance for booking #${bookingId.slice(-6)}`,
        }
      });

      // 2. Credit Booking Paid Amount
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          paidAmount: { increment: amount },
          paymentStatus: (booking.paidAmount + amount) >= booking.totalAmount ? 'PAID' : 'PARTIAL'
        }
      });

      return updatedBooking;
    });

    return NextResponse.json({
      success: true,
      message: 'Outstanding balance paid successfully via wallet.',
      booking: result
    });

  } catch (error: any) {
    console.error('Payment clear error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete top-up payment' }, { status: 500 });
  }
}
