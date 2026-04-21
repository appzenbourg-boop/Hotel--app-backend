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
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with referred guest details
    const referralsWithDetails = await Promise.all(
      referrals.map(async (ref) => {
        if (ref.referredId) {
          const referredGuest = await prisma.guest.findUnique({
            where: { id: ref.referredId },
            select: { name: true, phone: true },
          });
          return {
            id: ref.id,
            name: referredGuest?.name || 'Unknown',
            phone: referredGuest?.phone || '',
            status: ref.status,
            createdAt: ref.createdAt,
          };
        }
        return {
          id: ref.id,
          name: 'Pending signup',
          phone: '',
          status: ref.status,
          createdAt: ref.createdAt,
        };
      })
    );

    return NextResponse.json({ success: true, referrals: referralsWithDetails });
  } catch (error: any) {
    console.error('Get referral list error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
