import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const search = searchParams.get('search');

    const where: any = {};

    if (location) {
      where.address = { contains: location, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Only return properties that are visible (have rooms)
    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        images: true,
        logo: true,
        coverImage: true,
        checkInTime: true,
        checkOutTime: true,
        cancellationPolicy: true,
        latitude: true,
        longitude: true,
        ranking: true,
        features: true,
        plan: true,
      },
      orderBy: { ranking: 'desc' },
    });

    // Strip base64 images — only keep http URLs
    const sanitizeImages = (images: any[]): string[] => {
      if (!Array.isArray(images)) return [];
      return images
        .filter((img) => typeof img === 'string' && img.startsWith('http'))
        .slice(0, 5);
    };

    const result = properties.map((p) => ({
      ...p,
      images: sanitizeImages(p.images),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Properties fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
