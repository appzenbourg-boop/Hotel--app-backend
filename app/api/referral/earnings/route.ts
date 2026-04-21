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
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;
    if (!guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });

    const completedReferrals = await prisma.referral.findMany({
      where: {
        referrerId: guest.id,
        status: 'COMPLETED',
        rewardCredited: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    const earnings = completedReferrals.map((ref) => ({
      id: ref.id,
      amount: ref.rewardAmount,
      date: ref.completedAt,
      status: 'CREDITED',
    }));

    const totalEarnings = completedReferrals.reduce((sum, r) => sum + r.rewardAmount, 0);

    return NextResponse.json({ success: true, totalEarnings, earnings });
  } catch (error: any) {
    console.error('Get referral earnings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
