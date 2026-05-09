import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Direct relational lookup from unified DB
    const services = await (prisma as any).dashboardService.findMany({
      where: { 
        propertyId,
        isActive: true
      },
      orderBy: {
        order: 'asc'
      }
    });

    // Format standard array
    return NextResponse.json({ success: true, services });
  } catch (error: any) {
    console.error('[API DashboardServices Error]', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
