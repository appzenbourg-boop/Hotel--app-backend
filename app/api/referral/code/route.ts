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

function generateReferralCode(name: string): string {
  const namePrefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePrefix}${randomSuffix}`;
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve guest profile via user phone
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    let guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (!guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });

    // Generate referral code if doesn't exist
    if (!guest.referralCode) {
      const code = generateReferralCode(guest.name);
      guest = await prisma.guest.update({
        where: { id: guest.id },
        data: { referralCode: code },
      });
    }

    return NextResponse.json({
      success: true,
      code: guest.referralCode,
      link: `https://hotel.app/ref/${guest.referralCode}`,
    });
  } catch (error: any) {
    console.error('Get referral code error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
