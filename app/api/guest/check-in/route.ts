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

async function resolveGuest(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user) return null;
  return prisma.guest.findUnique({ where: { phone: user.phone } });
}

// POST /api/guest/check-in
// Called from the app's checkin screen after OTP verification
// Updates booking status to CHECKED_IN — admin panel sees this in /admin/checkin
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bookingId, idType, idNumber, numberOfGuests, specialRequests } = body;

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    // Find the booking — must belong to this guest
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        guestId: guest.id,
        status: 'RESERVED',
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or already checked in' }, { status: 404 });
    }

    // Update booking to CHECKED_IN — this is what admin panel monitors
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CHECKED_IN',
        actualCheckIn: new Date(),
        ...(numberOfGuests && { numberOfGuests }),
        ...(specialRequests && { specialRequests }),
      },
    });

    // Update guest check-in status and ID info — admin sees this in /admin/guests
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        checkInStatus: 'COMPLETED',
        checkInCompletedAt: new Date(),
        ...(idType && { idType }),
        ...(idNumber && { idNumber }),
      },
    });

    // Mark room as OCCUPIED
    await prisma.room.update({
      where: { id: booking.roomId },
      data: { status: 'OCCUPIED' },
    });

    return NextResponse.json({ success: true, booking: updated });
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}

// PATCH /api/guest/check-in — checkout
export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bookingId } = body;

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        guestId: guest.id,
        status: 'CHECKED_IN',
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Active booking not found' }, { status: 404 });
    }

    // Update booking to CHECKED_OUT — admin sees this in /admin/bookings
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: new Date(),
      },
    });

    // Free up the room
    await prisma.room.update({
      where: { id: booking.roomId },
      data: { status: 'AVAILABLE' },
    });

    return NextResponse.json({ success: true, booking: updated });
  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }
}
