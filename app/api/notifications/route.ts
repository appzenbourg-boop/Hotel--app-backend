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

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const onlyUnread = searchParams.get('unread') === 'true';

    const whereClause: any = { userId };
    if (onlyUnread) {
      whereClause.isRead = false;
    }

    const notifications = await prisma.inAppNotification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Fetch error', detail: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await prisma.inAppNotification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      });
    } else if (notificationId) {
      await prisma.inAppNotification.update({
        where: { id: notificationId, userId },
        data: { isRead: true }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Update error' }, { status: 500 });
  }
}
