import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/amenities — same amenities table admin manages in /admin/content/amenities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    const where: any = { isActive: true };
    if (propertyId) where.propertyId = propertyId;

    const items = await prisma.amenity.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        category: true,
        isActive: true,
      },
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Amenities error:', error);
    return NextResponse.json({ error: 'Failed to fetch amenities' }, { status: 500 });
  }
}
