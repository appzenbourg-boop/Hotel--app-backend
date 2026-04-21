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

// GET /api/services — get all service requests for this guest
// Admin panel reads the same service_requests collection in /admin/services
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve guest profile
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;

    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const requests = await prisma.serviceRequest.findMany({
      where: { guestId: guest.id },
      include: {
        room: { select: { roomNumber: true } },
        assignedTo: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('Services fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

// POST /api/services — create a service request from the app
// This immediately appears in admin panel's /admin/services queue for staff assignment
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, title, description, roomId, priority, amount } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'type and title are required' }, { status: 400 });
    }

    // Resolve guest profile
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;

    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    // Get room to resolve propertyId
    let propertyId: string | null = null;
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { propertyId: true },
      });
      propertyId = room?.propertyId ?? null;
    }

    // If no roomId, try to get propertyId from active booking
    if (!propertyId) {
      const activeBooking = await prisma.booking.findFirst({
        where: { guestId: guest.id, status: 'CHECKED_IN' },
        select: { propertyId: true, roomId: true },
      });
      propertyId = activeBooking?.propertyId ?? null;
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'Cannot determine property for this request' }, { status: 400 });
    }

    // Fetch custom SLA config if available (same as admin panel)
    let slaMinutes = type === 'MAINTENANCE' ? 60 : 30;
    try {
      const config = await prisma.serviceConfig.findUnique({
        where: { propertyId_type: { propertyId, type } },
        select: { totalSla: true },
      });
      if (config) slaMinutes = config.totalSla;
    } catch { /* service config may not exist */ }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        guestId: guest.id,
        roomId: roomId || null,
        propertyId,
        type,
        title,
        description: description || null,
        priority: priority || 'NORMAL',
        // Only set amount for food orders and spa
        amount: (type === 'FOOD_ORDER' || type === 'SPA') ? (amount || null) : null,
        status: 'PENDING',
        slaMinutes,
      },
    });

    return NextResponse.json({ success: true, request: serviceRequest });
  } catch (error: any) {
    console.error('Create service request error:', error);
    return NextResponse.json({ error: 'Failed to create service request' }, { status: 500 });
  }
}
