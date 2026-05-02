import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = verifyToken(token);
  return decoded ? decoded.id : null;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(services);
  } catch (error: any) {
    console.error('Dashboard services error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard services' }, { status: 500 });
  }
}
