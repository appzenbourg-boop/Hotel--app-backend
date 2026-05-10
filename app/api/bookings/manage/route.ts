import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = verifyToken(token);
  return decoded ? decoded.id : null;
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bookingId, type, newCheckOut, newRoomId } = body;

    if (!bookingId || !type) {
      return NextResponse.json({ error: 'bookingId and type are required' }, { status: 400 });
    }

    // Find the booking including necessary relations to propagate notifications properly
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        room: true,
        property: {
          select: { ownerIds: true }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!booking.propertyId) {
      return NextResponse.json({ error: 'Property linking error' }, { status: 400 });
    }

    // Generate unified workflow parameters aligning with original Admin spec
    const title = type === 'EXTEND' ? `Stay Extension Request` : `Room Upgrade Request`;
    const description = type === 'EXTEND' 
        ? `Guest requested to extend stay until ${newCheckOut ? new Date(newCheckOut).toLocaleDateString() : 'TBD'}`
        : `Guest requested a room upgrade from the current ${booking.room?.type || 'unit'}.`;

    // 🔑 Create ServiceRequest as logical anchor for ticket queues
    const serviceRequest = await prisma.serviceRequest.create({
        data: {
            type: 'CONCIERGE',
            title,
            description,
            guestId: booking.guestId,
            roomId: booking.roomId,
            propertyId: booking.propertyId,
            priority: 'HIGH',
            status: 'PENDING',
            notes: JSON.stringify({
                requestId: `SR-${Date.now()}`,
                bookingId,
                requestType: type,
                newCheckOut: newCheckOut || null,
                newRoomId: newRoomId || null,
                isStayAdjustment: true
            })
        }
    });

    // 🚀 BROADCAST IN-APP NOTIFICATIONS (Fires the Admin Header Bell & Sound)
    try {
      const admins = await prisma.user.findMany({
        where: {
          OR: [
            { id: { in: booking.property?.ownerIds || [] } },
            { 
              role: { in: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER', 'RECEPTIONIST'] }, 
              workplaceId: booking.propertyId 
            }
          ]
        },
        select: { id: true }
      });

      if (admins.length > 0) {
        await prisma.inAppNotification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: `⚠️ New ${type} Request`,
            description: `${title} from Room ${booking.room?.roomNumber || 'N/A'} requires verification.`,
            type: 'ALERT',
            isRead: false
          }))
        });
      }
    } catch (notifyErr) {
      console.error("InAppNotification deployment skipped/failed:", notifyErr);
    }

    // Automatically spawn System Alert for internal dash charts
    try {
      await prisma.systemAlert.create({
        data: {
          propertyId: booking.propertyId,
          message: `⚠️ New ${type} Request`,
          description: `${title} submitted for Room ${booking.room?.roomNumber || 'N/A'}`,
          type: 'INFO',
          category: 'RECEPTIONIST'
        }
      });
    } catch(e) {
      console.log("Alert creation skip", e);
    }

    return NextResponse.json({
      success: true,
      requestId: serviceRequest.id,
      message: 'Your request has been submitted for staff approval.'
    });

  } catch (error: any) {
    console.error('Booking management error:', error);
    return NextResponse.json({ error: 'Failed to manage booking', detail: error.message }, { status: 500 });
  }
}
