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

    // Step 1: Verify standard context and properties
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        room: true,
        property: { select: { ownerIds: true } }
      }
    });

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (!booking.propertyId) return NextResponse.json({ error: 'Property ID invalid' }, { status: 400 });

    // Normalize Type for unified BookingRequest architecture (Main schema uses EXTENSION)
    const unifiedType = type === 'EXTEND' ? 'EXTENSION' : 'UPGRADE';

    // Step 2: Calculate actual extra charge
    const requestDetails: any = {};
    
    if (unifiedType === 'EXTENSION') {
      requestDetails.newCheckOut = newCheckOut;
      // Calculate extra nights cost
      const currentCheckOut = new Date(booking.checkOut);
      const newCheckOutDate = new Date(newCheckOut);
      const extraNightsMs = newCheckOutDate.getTime() - currentCheckOut.getTime();
      const extraNights = Math.max(0, Math.ceil(extraNightsMs / (1000 * 60 * 60 * 24)));
      const perNightRate = booking.room?.basePrice || 0;
      requestDetails.extraCharge = extraNights * perNightRate;
      requestDetails.extraNights = extraNights;
      requestDetails.perNightRate = perNightRate;
    } else {
      requestDetails.newRoomId = newRoomId;
      // Calculate upgrade price difference
      const newRoom = await prisma.room.findUnique({ where: { id: newRoomId } });
      const currentRoomPrice = booking.room?.basePrice || 0;
      const newRoomPrice = newRoom?.basePrice || 0;
      const priceDiff = Math.max(0, newRoomPrice - currentRoomPrice);
      // Calculate remaining nights
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const remainingNightsMs = checkOut.getTime() - Math.max(checkIn.getTime(), Date.now());
      const remainingNights = Math.max(1, Math.ceil(remainingNightsMs / (1000 * 60 * 60 * 24)));
      requestDetails.extraCharge = priceDiff * remainingNights;
      requestDetails.priceDifference = priceDiff;
      requestDetails.remainingNights = remainingNights;
      requestDetails.newRoomPrice = newRoomPrice;
    }

    // 🔑 STEP 3: THE MASTER FIX — Write directly into official BOOKING REQUEST TABLE
    // This guarantees it populates the exact "Approvals" tab on the admin side instantly!
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        bookingId: booking.id,
        type: unifiedType as any,
        status: 'PENDING',
        details: requestDetails,
        requestedById: userId
      }
    });

    // Also maintain historical ServiceRequest compatibility loop if other micro-agents rely on it
    try {
      await prisma.serviceRequest.create({
        data: {
          type: 'CONCIERGE',
          title: `${unifiedType} Request`,
          description: `Automatic operational sync via approvals pipeline.`,
          guestId: booking.guestId,
          roomId: booking.roomId,
          propertyId: booking.propertyId,
          priority: 'HIGH',
          status: 'PENDING',
          notes: JSON.stringify({
              requestId: `BR-${bookingRequest.id}`,
              bookingId,
              requestType: unifiedType,
              isStayAdjustment: true
          })
        }
      });
    } catch(e) {}

    // 🚀 BROADCAST IN-APP NOTIFICATIONS (Forces the Alert Icon red and directs user to /admin/approvals)
    try {
      const admins = await prisma.user.findMany({
        where: {
          OR: [
            { id: { in: booking.property?.ownerIds || [] } },
            { role: { in: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER'] }, workplaceId: booking.propertyId }
          ]
        },
        select: { id: true }
      });

      if (admins.length > 0) {
        await prisma.inAppNotification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: `New ${unifiedType} Request`, // Using standard title
            description: `${unifiedType} required for Booking in Room ${booking.room?.roomNumber || 'N/A'}.`, // NO 'verification' word to avoid routing clash
            type: 'ALERT',
            isRead: false
          }))
        });
      }
    } catch(e) {}

    // Push to master dashboard event timeline
    try {
      await prisma.systemAlert.create({
        data: {
          propertyId: booking.propertyId,
          message: `⚡ Operation ${unifiedType}`,
          description: `${unifiedType} requested for Room ${booking.room?.roomNumber || 'N/A'}`,
          type: 'INFO',
          category: 'RECEPTIONIST'
        }
      });
    } catch(e) {}

    return NextResponse.json({
      success: true,
      requestId: bookingRequest.id,
      message: 'Your update request has been forwarded to hotel staff for review.'
    });

  } catch (error: any) {
    console.error('Route processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
