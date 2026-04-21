import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Use raw MongoDB command to bypass enum validation on legacy plan values
    const result = await (prisma as any).$runCommandRaw({
      find: 'properties',
      filter: { _id: { $oid: id } },
      limit: 1,
    });

    const raw = result?.cursor?.firstBatch?.[0];
    if (!raw) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
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
        if (out[key]?.$numberDouble) out[key] = parseFloat(out[key].$numberDouble);
      }
      return out;
    };

    const property = normalizeDoc(raw);

    // Strip base64 images
    const sanitizeImages = (images: any[]): string[] => {
      if (!Array.isArray(images)) return [];
      return images
        .filter((img) => typeof img === 'string' && img.startsWith('http'))
        .slice(0, 5);
    };

    property.images = sanitizeImages(property.images);

    // Fetch amenities separately (they're in a separate collection)
    const amenitiesResult = await (prisma as any).$runCommandRaw({
      find: 'amenities',
      filter: { propertyId: { $oid: id }, isActive: true },
    });

    const amenitiesRaw = amenitiesResult?.cursor?.firstBatch ?? [];
    const amenities = amenitiesRaw.map((a: any) => {
      const norm = normalizeDoc(a);
      return {
        id: norm.id,
        name: norm.name,
        icon: norm.icon,
        category: norm.category,
        description: norm.description,
      };
    });

    return NextResponse.json({ ...property, amenities });
  } catch (error: any) {
    console.error('Property fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch property', detail: error.message }, { status: 500 });
  }
}
