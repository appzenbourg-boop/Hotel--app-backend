import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Use raw command to bypass enum validation on old room records
    const result = await (prisma as any).$runCommandRaw({
      find: 'rooms',
      filter: { _id: { $oid: id } },
      limit: 1,
    });

    const raw = result?.cursor?.firstBatch?.[0];
    if (!raw) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Normalize ObjectId fields
    const normalizeDoc = (doc: any): any => {
      const out: any = { ...doc };
      if (out._id?.$oid) out.id = out._id.$oid;
      for (const key of Object.keys(out)) {
        if (out[key]?.$oid) out[key] = out[key].$oid;
        if (out[key]?.$date) out[key] = new Date(out[key].$date).toISOString();
        if (out[key]?.$numberLong) out[key] = parseInt(out[key].$numberLong);
        if (out[key]?.$numberInt) out[key] = parseInt(out[key].$numberInt);
      }
      return out;
    };

    const room = normalizeDoc(raw);

    // Strip base64 images
    const sanitizeImages = (images: any[]): string[] => {
      if (!Array.isArray(images)) return [];
      return images
        .filter((img) => typeof img === 'string' && img.startsWith('http'))
        .slice(0, 3);
    };

    room.images = sanitizeImages(room.images);

    // Enrich with property
    const property = room.propertyId
      ? await prisma.property.findUnique({
          where: { id: room.propertyId },
          select: {
            id: true,
            name: true,
            address: true,
            images: true,
            checkInTime: true,
            checkOutTime: true,
            latitude: true,
            longitude: true,
            phone: true,
            email: true,
            amenities: {
              where: { isActive: true },
              select: { id: true, name: true, icon: true }
            }
          },
        })
      : null;

    // Fetch dynamic settings for this property
    let settings = null;
    if (property) {
      try {
        settings = await (prisma as any).propertySettings.findUnique({
          where: { propertyId: property.id }
        });
      } catch (e) {
        console.log('[GuestAPI] Settings fetch fallback:', e);
      }
    }

    // Fetch active/upcoming bookings to support date blocking in client calendars
    let roomBookings: any[] = [];
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookingsResult = await (prisma as any).$runCommandRaw({
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

      const rawBookings = bookingsResult?.cursor?.firstBatch ?? [];
      roomBookings = rawBookings.map((doc: any) => ({
        id: doc._id?.$oid || doc._id,
        checkIn: doc.checkIn?.$date ? new Date(doc.checkIn.$date).toISOString() : doc.checkIn,
        checkOut: doc.checkOut?.$date ? new Date(doc.checkOut.$date).toISOString() : doc.checkOut,
        status: doc.status,
      }));
    } catch (bookingErr) {
      console.error('[GuestAPI] Bookings fetch fallback err:', bookingErr);
    }

    const enhancedProperty = property ? {
      ...property,
      settings: settings || {
        gstPercent: 18.0,
        serviceChargePercent: 0.0,
        luxuryTaxPercent: 0.0,
        defaultDiscountPercent: 0.0
      }
    } : null;

    return NextResponse.json({ 
      ...room, 
      property: enhancedProperty, 
      bookings: roomBookings 
    });
  } catch (error: any) {
    console.error('Room fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch room', detail: error.message }, { status: 500 });
  }
}
