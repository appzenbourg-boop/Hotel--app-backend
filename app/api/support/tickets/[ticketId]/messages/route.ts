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

// POST /api/support/tickets/[ticketId]/messages
// Admin panel reads these messages in /admin/support/[id]
export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticketId } = await params;
    const { content } = await request.json();

    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    // Resolve guest id for senderId
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const guest = user ? await prisma.guest.findUnique({ where: { phone: user.phone } }) : null;

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        content,
        senderId: guest?.id ?? userId,
        senderRole: 'GUEST',
      },
    });

    // Update ticket updatedAt
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Add message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
