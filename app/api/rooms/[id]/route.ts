import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
          },
        })
      : null;

    return NextResponse.json({ ...room, property });
  } catch (error: any) {
    console.error('Room fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch room', detail: error.message }, { status: 500 });
  }
}
