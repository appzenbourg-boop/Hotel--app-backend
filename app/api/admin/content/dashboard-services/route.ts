import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getAuthData(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyToken(token) as any;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authData = getAuthData(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    const services = await prisma.dashboardService.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        iconUrl: true,
        iconName: true,
        route: true,
        isActive: true,
        order: true,
        options: true,
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(services);
  } catch (error: any) {
    console.error('Dashboard services GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard services' }, { status: 500 });
  }
}
