import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
import { verifyToken } from '@/lib/auth';

function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = verifyToken(token);
  return decoded ? decoded.id : null;
}

// Resolve guest — added self-healing to auto-create missing records
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

// GET /api/guest/profile
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const guest = await resolveGuest(userId);

    return NextResponse.json({ ...user, ...guest });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT /api/guest/profile
export async function PUT(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, email, address, language, profileImage } = body;

    // Update user record
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest profile not found' }, { status: 404 });

    // Update guest profile (admin panel reads this in /admin/guests)
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(address !== undefined && { address }),
        ...(language && { language }),
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
