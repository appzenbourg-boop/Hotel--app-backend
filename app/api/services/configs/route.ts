import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/services/configs?propertyId=xxx
// Housekeeping screen calls this to get dynamic service options
// Admin manages these in /admin/services (service configs)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const configs = await prisma.serviceConfig.findMany({
      where: { propertyId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Return in the format the app expects: { success, configs }
    // Each config has: type, totalSla, options (JSON), steps
    return NextResponse.json({ success: true, configs });
  } catch (error: any) {
    console.error('Service configs error:', error);
    return NextResponse.json({ error: 'Failed to fetch service configs' }, { status: 500 });
  }
}
