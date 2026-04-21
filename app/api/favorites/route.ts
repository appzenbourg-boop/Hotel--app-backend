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

// Resolve guest from userId — tries user table first, then falls back to guest table directly
async function resolveGuest(userId: string) {
  // Try via user → phone → guest (normal flow)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (user) {
    const guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (guest) return guest;
  }
  // Fallback: token might carry guest.id directly (old tokens)
  const guestDirect = await prisma.guest.findUnique({ where: { id: userId } });
  return guestDirect;
}

// GET /api/favorites
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    // Fetch favorites — skip any whose room was deleted (orphaned records)
    const favorites = await prisma.favorite.findMany({
      where: { guestId: guest.id },
      orderBy: { createdAt: 'desc' },
    });

    if (favorites.length === 0) return NextResponse.json([]);

    // Manually fetch rooms to handle orphaned favorites gracefully
    const roomIds = favorites.map((f) => f.roomId);
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            images: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    // Filter out favorites whose room no longer exists
    const result = favorites
      .filter((f) => roomMap.has(f.roomId))
      .map((f) => ({
        ...roomMap.get(f.roomId),
        favoriteId: f.id,
        roomId: f.roomId,
        favoritedAt: f.createdAt,
      }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Favorites fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

// POST /api/favorites
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const { roomId } = await request.json();
    if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 });

    const existing = await prisma.favorite.findUnique({
      where: { guestId_roomId: { guestId: guest.id, roomId } },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Already favorited', favorite: existing });
    }

    const favorite = await prisma.favorite.create({
      data: { guestId: guest.id, roomId },
    });

    return NextResponse.json({ success: true, favorite });
  } catch (error: any) {
    console.error('Add favorite error:', error);
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

// DELETE /api/favorites?roomId=xxx
export async function DELETE(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 });

    await prisma.favorite.deleteMany({
      where: { guestId: guest.id, roomId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove favorite error:', error);
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
