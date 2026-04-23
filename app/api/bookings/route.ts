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

// Resolve guest — handles new tokens (user.id) and old tokens (guest.id)
async function resolveGuest(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (user) {
    const guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (guest) return guest;
  }
  return prisma.guest.findUnique({ where: { id: userId } });
}

function safeSerialize(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

// GET /api/bookings
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // Use MongoDB $runCommandRaw to bypass Prisma enum validation.
    const filter: any = { guestId: { $oid: guest.id } };
    if (status) {
      if (status.includes(',')) {
        filter.status = { $in: status.split(',') };
      } else {
        filter.status = status;
      }
    }

    const [result, countResult] = await Promise.all([
      (prisma as any).$runCommandRaw({
        find: 'bookings',
        filter,
        sort: { createdAt: -1 },
        limit: limit,
        skip: skip,
      }),
      (prisma as any).$runCommandRaw({
        count: 'bookings',
        query: filter,
      })
    ]);

    const bookingsRaw: any[] = result?.cursor?.firstBatch ?? [];
    const totalCount = countResult?.n ?? 0;

    if (bookingsRaw.length === 0) {
      return NextResponse.json({ success: true, bookings: [], total: totalCount, page, limit });
    }

    // Normalize MongoDB _id/$oid fields to plain strings
    const normalizeId = (doc: any): any => {
      if (!doc) return doc;
      const out: any = { ...doc };
      if (out._id?.$oid) out.id = out._id.$oid;
      // Normalize all ObjectId fields
      for (const key of Object.keys(out)) {
        if (out[key]?.$oid) out[key] = out[key].$oid;
        if (out[key]?.$date) out[key] = new Date(out[key].$date).toISOString();
        if (out[key]?.$numberLong) out[key] = parseInt(out[key].$numberLong);
      }
      return out;
    };

    const normalized = bookingsRaw.map(normalizeId);

    // Enrich with room + property
    const roomIds = [...new Set(normalized.map((b: any) => b.roomId).filter(Boolean))];
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds as string[] } },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            images: true,
            checkInTime: true,
            checkOutTime: true,
            phone: true,
          },
        },
      },
    });
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    const bookings = normalized.map((b: any) => ({
      ...b,
      room: roomMap.get(b.roomId) || null,
    }));

    return NextResponse.json({ 
      success: true, 
      bookings: safeSerialize(bookings),
      total: totalCount,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Bookings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings', detail: error.message }, { status: 500 });
  }
}

// POST /api/bookings
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { roomId, checkIn, checkOut, numberOfGuests, specialRequests, totalAmount } = body;

    if (!roomId || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'roomId, checkIn and checkOut are required' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, propertyId: true, basePrice: true, status: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // Conflict check
    const conflicting = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['RESERVED', 'CHECKED_IN'] },
        checkIn: { lt: new Date(checkOut) },
        checkOut: { gt: new Date(checkIn) },
      },
    });
    if (conflicting) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 });
    }

    // Resolve or create guest
    let guest = await resolveGuest(userId);
    if (!guest) {
      const userFull = await prisma.user.findUnique({ where: { id: userId } });
      if (!userFull) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      guest = await prisma.guest.create({
        data: {
          name: userFull.name,
          phone: userFull.phone,
          email: userFull.email,
          checkInStatus: 'PENDING',
        },
      });
    }

    const newBooking = await prisma.booking.create({
      data: {
        guestId: guest.id,
        roomId,
        propertyId: room.propertyId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        numberOfGuests: numberOfGuests ?? 1,
        specialRequests: specialRequests || null,
        totalAmount: totalAmount || 0,
        paidAmount: totalAmount || 0,
        paymentStatus: 'PAID',
        status: 'RESERVED',
        source: 'OTHER',
      },
      include: {
        room: {
          include: {
            property: { select: { id: true, name: true, address: true } },
          },
        },
      },
    });

    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'OCCUPIED' },
    });

    return NextResponse.json({ success: true, booking: safeSerialize(newBooking) });
  } catch (error: any) {
    console.error('Create booking error:', error);
    return NextResponse.json({ error: 'Failed to create booking', detail: error.message }, { status: 500 });
  }
}

// PATCH /api/bookings
export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bookingId, status } = body;
    if (!bookingId || !status) {
      return NextResponse.json({ error: 'bookingId and status are required' }, { status: 400 });
    }

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, guestId: guest.id },
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    if (status === 'CANCELLED') {
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { status: 'AVAILABLE' },
      });
    }

    return NextResponse.json({ success: true, booking: safeSerialize(updated) });
  } catch (error: any) {
    console.error('Update booking error:', error);
    return NextResponse.json({ error: 'Failed to update booking', detail: error.message }, { status: 500 });
  }
}
