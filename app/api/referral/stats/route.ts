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

    const referrals = await prisma.referral.findMany({
      where: { referrerId: guest.id },
    });

    const completed = referrals.filter((r) => r.status === 'COMPLETED');
    const pending = referrals.filter((r) => r.status === 'PENDING');
    const totalEarnings = completed.reduce((sum, r) => sum + r.rewardAmount, 0);

    return NextResponse.json({
      success: true,
      totalEarnings,
      totalReferrals: referrals.length,
      completedReferrals: completed.length,
      pendingReferrals: pending.length,
      rewardPerReferral: 100,
    });
  } catch (error: any) {
    console.error('Get referral stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
