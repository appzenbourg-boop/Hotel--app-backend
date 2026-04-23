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
    const { serviceRequestId, rating, comment, type } = body;

    if (!rating) {
      return NextResponse.json({ error: 'rating is required' }, { status: 400 });
    }

    // Resolve guest profile
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;

    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    let assignedToId = null;
    
    // If serviceRequestId is provided, validate it and get assigned staff
    if (serviceRequestId) {
      const serviceRequest = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequestId },
        select: { assignedToId: true, type: true }
      });

      if (!serviceRequest) {
        return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
      }
      assignedToId = serviceRequest.assignedToId;
    }

    // 1. Create the rating entry
    const ratingEntry = await prisma.rating.create({
      data: {
        guestId: guest.id,
        serviceRequestId: serviceRequestId || null,
        rating: parseInt(rating),
        comment: comment || null,
        type: type || (serviceRequestId ? 'SERVICE' : 'OVERALL_STAY'),
      },
    });

    // 2. Update Staff Performance Score if applicable
    if (assignedToId) {
      const now = new Date();
      const month = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();

      // Get all ratings for this staff member
      const allStaffRatings = await prisma.rating.findMany({
        where: {
          serviceRequest: {
            assignedToId: assignedToId
          }
        },
        select: { rating: true }
      });

      const avg = allStaffRatings.reduce((sum, r) => sum + r.rating, 0) / (allStaffRatings.length || 1);

      // Update or Create Performance Score for the current month
      await prisma.performanceScore.upsert({
        where: {
          staffId_month_year: {
            staffId: assignedToId,
            month,
            year
          }
        },
        update: {
          avgRating: avg,
          tasksCompleted: { increment: 1 }
        },
        create: {
          staffId: assignedToId,
          month,
          year,
          avgRating: avg,
          tasksCompleted: 1,
          tasksOnTime: 1
        }
      });
    }

    return NextResponse.json({ success: true, rating: ratingEntry });
  } catch (error: any) {
    console.error('Rating submission error:', error);
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 });
  }
}
