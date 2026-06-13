import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = verifyToken(token);
    return decoded ? decoded.id : null;
  } catch (error) {
    return null;
  }
}

// DELETE /api/auth/account
export async function DELETE(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Resolve Guest using userId or phone
    let guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (!guest) {
        guest = await prisma.guest.findUnique({ where: { id: user.id } }); // fallback if ID matched
    }

    const transactions: any[] = [];

    if (guest) {
      const guestId = guest.id;

      // Clean up wallet and wallet transactions
      const wallet = await prisma.wallet.findUnique({ where: { guestId } });
      if (wallet) {
        transactions.push(prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } }));
        transactions.push(prisma.wallet.delete({ where: { id: wallet.id } }));
      }

      // Cascade delete related records
      transactions.push(prisma.favorite.deleteMany({ where: { guestId } }));
      transactions.push(prisma.rating.deleteMany({ where: { guestId } }));
      transactions.push(prisma.supportTicket.deleteMany({ where: { guestId } }));
      transactions.push(prisma.serviceRequest.deleteMany({ where: { guestId } }));
      transactions.push(prisma.lostItem.deleteMany({ where: { guestId } }));
      transactions.push(prisma.booking.deleteMany({ where: { guestId } }));

      // Clean up referrals where this guest was the referrer
      transactions.push(prisma.referral.deleteMany({ where: { referrerId: guestId } }));

      // Finally, delete the guest profile
      transactions.push(prisma.guest.delete({ where: { id: guestId } }));
    }

    // Delete the actual user record
    transactions.push(prisma.user.delete({ where: { id: userId } }));

    // Execute transaction safely
    await prisma.$transaction(transactions);

    return NextResponse.json({ success: true, message: 'Account permanently deleted' });

  } catch (error: any) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
