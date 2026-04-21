import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/menu — same menu_items table admin manages in /admin/content/menu
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isVegParam = searchParams.get('isVeg');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    const where: any = { isAvailable: true };

    if (category) where.category = category;
    if (isVegParam === 'true') where.isVeg = true;
    if (isVegParam === 'false') where.isVeg = false;
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { cuisine: { contains: search, mode: 'insensitive' } },
      ];
    }

    const menuItems = await prisma.menuItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        cuisine: true,
        price: true,
        images: true,
        isVeg: true,
        isAvailable: true,
        prepTime: true,
        propertyId: true,
      },
      orderBy: { category: 'asc' },
      take: 100, // cap at 100 items
    });

    // The app reads item.image (singular) but schema has images[] — map it
    // Also strip base64 images — only keep http URLs
    const result = menuItems.map((item) => ({
      ...item,
      image: item.images?.find((img) => typeof img === 'string' && img.startsWith('http')) || null,
      images: undefined, // remove the array to keep response small
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Menu fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });
  }
}
