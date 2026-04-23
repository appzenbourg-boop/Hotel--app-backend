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
    const { bookingId, type, newCheckOut, newRoomId } = body;

    if (!bookingId || !type) {
      return NextResponse.json({ error: 'bookingId and type are required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (type === 'EXTEND') {
      if (!newCheckOut) return NextResponse.json({ error: 'newCheckOut is required' }, { status: 400 });

      // Update checkOut date
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { checkOut: new Date(newCheckOut) }
      });

      return NextResponse.json({ success: true, booking: updated });
    }

    if (type === 'UPGRADE') {
      if (!newRoomId) return NextResponse.json({ error: 'newRoomId is required' }, { status: 400 });

      // Free old room, occupy new room
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { status: 'AVAILABLE' }
      });

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { roomId: newRoomId }
      });

      await prisma.room.update({
        where: { id: newRoomId },
        data: { status: 'OCCUPIED' }
      });

      return NextResponse.json({ success: true, booking: updated });
    }

    return NextResponse.json({ error: 'Invalid management type' }, { status: 400 });
  } catch (error: any) {
    console.error('Booking management error:', error);
    return NextResponse.json({ error: 'Failed to manage booking', detail: error.message }, { status: 500 });
  }
}
