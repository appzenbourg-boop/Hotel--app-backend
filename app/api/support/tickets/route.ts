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

async function resolveGuest(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user) return null;
  return prisma.guest.findUnique({ where: { phone: user.phone } });
}

// GET /api/support/tickets — admin sees these in /admin/support
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const tickets = await prisma.supportTicket.findMany({
      where: { guestId: guest.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    console.error('Tickets fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST /api/support/tickets — creates ticket visible in admin panel's /admin/support
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    const body = await request.json();
    const { type, subject, message, propertyId, priority } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: 'subject and message are required' }, { status: 400 });
    }

    // Try to find propertyId from active booking if not provided
    let resolvedPropertyId = propertyId || null;
    if (!resolvedPropertyId) {
      const activeBooking = await prisma.booking.findFirst({
        where: { guestId: guest.id, status: { in: ['RESERVED', 'CHECKED_IN'] } },
        select: { propertyId: true },
        orderBy: { createdAt: 'desc' },
      });
      resolvedPropertyId = activeBooking?.propertyId ?? null;
    }

    const newTicket = await prisma.supportTicket.create({
      data: {
        guestId: guest.id,
        propertyId: resolvedPropertyId,
        // Map LOST_ITEM to OTHER since schema only allows TECHNICAL|BOOKING|PAYMENT|OTHER
        type: (type === 'LOST_ITEM' ? 'OTHER' : type) || 'OTHER',
        subject,
        message,
        priority: priority || 'NORMAL',
        status: 'OPEN',
      },
    });

    // Create the initial message thread entry
    await prisma.ticketMessage.create({
      data: {
        ticketId: newTicket.id,
        content: message,
        senderId: guest.id,
        senderRole: 'GUEST',
      },
    });

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error: any) {
    console.error('Create ticket error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create ticket' }, { status: 500 });
  }
}
