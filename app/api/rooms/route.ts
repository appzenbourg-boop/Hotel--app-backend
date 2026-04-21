import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const available = searchParams.get('available');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    // Build MongoDB filter manually to bypass Prisma enum validation
    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (available === 'true') filter.status = 'AVAILABLE';
    if (propertyId) filter.propertyId = { $oid: propertyId };
    if (search) {
      filter.$or = [
        { type: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    // Use MongoDB raw command to bypass enum validation
    const result = await (prisma as any).$runCommandRaw({
      find: 'rooms',
      filter,
      sort: { roomNumber: 1 },
      limit: 200,
    });

    const roomsRaw: any[] = result?.cursor?.firstBatch ?? [];

    // Normalize MongoDB ObjectId fields
    const normalizeDoc = (doc: any): any => {
      if (!doc) return doc;
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

    const rooms = roomsRaw.map(normalizeDoc);

    // Strip base64 images — only keep the first image URL (not base64)
    const sanitizeImages = (images: any[]): string[] => {
      if (!Array.isArray(images)) return [];
      return images
        .filter((img) => typeof img === 'string' && img.startsWith('http'))
        .slice(0, 3); // max 3 URLs per room
    };

    // Enrich with property data
    const propertyIds = [...new Set(rooms.map((r: any) => r.propertyId).filter(Boolean))];
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds as string[] } },
      select: {
        id: true,
        name: true,
        address: true,
        images: true,
        checkInTime: true,
        checkOutTime: true,
        latitude: true,
        longitude: true,
      },
    });
    const propertyMap = new Map(properties.map((p) => [p.id, p]));

    const enriched = rooms.map((r: any) => ({
      ...r,
      images: sanitizeImages(r.images),
      property: propertyMap.get(r.propertyId) || null,
    }));

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('Rooms fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms', detail: error.message }, { status: 500 });
  }
}
