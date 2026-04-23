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

// Resolve guest — added self-healing to auto-create missing records
async function resolveGuest(userId: string) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { id: true, name: true, phone: true, email: true } 
  });
  
  if (user) {
    let guest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: user.name,
          phone: user.phone,
          email: user.email,
          checkInStatus: 'PENDING',
          referralCode: `${user.name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
        }
      });
      await prisma.wallet.upsert({
        where: { guestId: guest.id },
        update: {},
        create: { guestId: guest.id, balance: 0 }
      });
    }
    return guest;
  }
  return await prisma.guest.findUnique({ where: { id: userId } });
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

    const guest = await resolveGuest(userId);
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

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
