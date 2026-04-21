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

// GET /api/services/[id] — get a single service request with assigned staff info
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        room: { select: { roomNumber: true } },
        assignedTo: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: serviceRequest });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch service request' }, { status: 500 });
  }
}

// POST /api/services/[id]/message — guest sends a message to the assigned staff
// This creates a Message record that staff sees in their /staff/messages portal
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Get the service request to find assigned staff
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { userId: true, user: { select: { name: true } } },
        },
      },
    });

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    // Create message linked to this service request
    // Staff sees this in their messages portal
    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: serviceRequest.assignedTo?.userId ?? null,
        serviceRequestId: id,
        content: content.trim(),
        category: 'GUEST',
        type: 'TEXT',
        isRead: false,
      },
    });

    // Create in-app notification for the assigned staff member
    if (serviceRequest.assignedTo?.userId) {
      await prisma.inAppNotification.create({
        data: {
          userId: serviceRequest.assignedTo.userId,
          title: 'Guest Message',
          description: content.trim().slice(0, 80),
          type: 'INFO',
          isRead: false,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
