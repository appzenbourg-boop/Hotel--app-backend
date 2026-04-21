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

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ success: false, error: 'Referral code is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;
    if (!guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });

    // Find referrer by code
    const referrer = await prisma.guest.findFirst({ where: { referralCode: code } });
    if (!referrer) {
      return NextResponse.json({ success: false, error: 'Invalid referral code' }, { status: 400 });
    }

    if (referrer.id === guest.id) {
      return NextResponse.json({ success: false, error: 'Cannot use your own referral code' }, { status: 400 });
    }

    if (guest.referredBy) {
      return NextResponse.json({ success: false, error: 'Referral code already applied' }, { status: 400 });
    }

    // Create referral record
    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: guest.id,
        code,
        status: 'PENDING',
        rewardAmount: 100,
        rewardCredited: false,
      },
    });

    // Mark guest as referred
    await prisma.guest.update({
      where: { id: guest.id },
      data: { referredBy: code },
    });

    return NextResponse.json({
      success: true,
      reward: 100,
      message: "Referral code applied! You'll get ₹100 after your first booking.",
    });
  } catch (error: any) {
    console.error('Apply referral code error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
