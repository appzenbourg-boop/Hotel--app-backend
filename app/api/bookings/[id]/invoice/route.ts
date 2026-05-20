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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params;
    const userId = getUserIdFromRequest(request);

    // Fetch booking with room and guest info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        guest: true,
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Fetch service requests during the stay period
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        guestId: booking.guestId,
        roomId: booking.roomId,
        createdAt: { gte: booking.checkIn },
        status: { in: ['PENDING', 'ACCEPTED', 'COMPLETED', 'IN_PROGRESS'] }
      }
    });

    // Fetch approved booking requests (upgrades/extensions)
    const bookingRequests = await prisma.bookingRequest.findMany({
      where: {
        bookingId: booking.id,
        status: 'APPROVED'
      }
    });

    // Calculate nights
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // 1. Room Charge
    const roomCharge = (booking.room.basePrice || 0) * nights;

    // 2. Culinary Charges (Food Orders)
    const culinaryCharge = serviceRequests
      .filter(s => s.type === 'FOOD_ORDER' || s.type === 'ROOM_SERVICE')
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    // 3. Service Charges (Other paid services)
    const serviceCharge = serviceRequests
      .filter(s => s.type !== 'FOOD_ORDER' && s.type !== 'ROOM_SERVICE')
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    // 4. Upgrade/Extension Charges
    let upgradeCharge = 0;
    let extensionCharge = 0;
    const adjustmentItems: { type: string; description: string; amount: number }[] = [];
    
    for (const req of bookingRequests) {
      const details = req.details as any;
      const charge = details?.extraCharge || 0;
      if (req.type === 'UPGRADE') {
        upgradeCharge += charge;
        adjustmentItems.push({
          type: 'UPGRADE',
          description: `Room Upgrade (Diff: INR ${details?.priceDifference || 0}/night x ${details?.remainingNights || 1} nights)`,
          amount: charge
        });
      } else if (req.type === 'EXTENSION') {
        extensionCharge += charge;
        adjustmentItems.push({
          type: 'EXTENSION',
          description: `Stay Extension (${details?.extraNights || 0} extra nights x INR ${details?.perNightRate || 0}/night)`,
          amount: charge
        });
      }
    }

    // 5. Tax (12% on room charge only)
    const tax = roomCharge * 0.12;

    // 6. Total Calculations
    const totalAmount = roomCharge + culinaryCharge + serviceCharge + upgradeCharge + extensionCharge + tax;
    const paidAmount = (booking as any).paidAmount || 0;
    const balanceAmount = Math.max(0, totalAmount - paidAmount);

    return NextResponse.json({
      success: true,
      invoice: {
        bookingId: booking.id,
        guestName: booking.guest.name,
        roomNumber: booking.room.roomNumber,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        roomCharge,
        culinaryCharge,
        serviceCharge,
        upgradeCharge,
        extensionCharge,
        adjustmentItems,
        tax,
        totalStayAmount: totalAmount,
        paidAlready: paidAmount,
        balanceAmount: balanceAmount,
        currency: 'INR',
      }
    });
  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}
