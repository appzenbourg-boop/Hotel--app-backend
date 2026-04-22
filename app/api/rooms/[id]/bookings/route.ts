import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/rooms/[id]/bookings — returns active/upcoming bookings for a room
// Used by the mobile app to block already-booked dates in the calendar
// This endpoint is PUBLIC (no auth required) so guests can see availability before booking
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use $runCommandRaw to bypass Prisma enum validation issues
    // (old bookings may have source='MOBILE_APP' which isn't in the enum)
    const result = await (prisma as any).$runCommandRaw({
      find: 'bookings',
      filter: {
        roomId: { $oid: id },
        status: { $in: ['RESERVED', 'CHECKED_IN'] },
        checkOut: { $gte: { $date: today.toISOString() } },
      },
      projection: {
        _id: 1,
        checkIn: 1,
        checkOut: 1,
        status: 1,
      },
      sort: { checkIn: 1 },
    });

    const raw: any[] = result?.cursor?.firstBatch ?? [];

    const bookings = raw.map((doc: any) => ({
      id: doc._id?.$oid || doc._id,
      checkIn: doc.checkIn?.$date ? new Date(doc.checkIn.$date).toISOString() : doc.checkIn,
      checkOut: doc.checkOut?.$date ? new Date(doc.checkOut.$date).toISOString() : doc.checkOut,
      status: doc.status,
    }));

    return NextResponse.json({ bookings });
  } catch (error: any) {
    console.error('Room bookings fetch error:', error);
    return NextResponse.json({ bookings: [] });
  }
}
