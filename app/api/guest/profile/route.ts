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

    // Also get guest profile for extra fields (address, language, etc.)
    const guest = await prisma.guest.findUnique({
      where: { phone: user.phone },
      select: {
        id: true,
        address: true,
        dateOfBirth: true,
        language: true,
        idType: true,
        idNumber: true,
        checkInStatus: true,
        referralCode: true,
      },
    });

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

    // Update guest profile (admin panel reads this in /admin/guests)
    await prisma.guest.update({
      where: { phone: updatedUser.phone },
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
