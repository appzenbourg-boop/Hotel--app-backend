import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    // Find user by phone — same users table as admin panel
    const user = await prisma.user.findFirst({
      where: { phone },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid phone number or password' }, { status: 401 });
    }

    // Ensure Guest profile exists (admin panel does this too)
    const existingGuest = await prisma.guest.findUnique({ where: { phone: user.phone } });
    if (!existingGuest) {
      await prisma.guest.create({
        data: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          checkInStatus: 'PENDING',
        },
      });
    }

    const token = signToken({ id: user.id, role: user.role });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
  }
}
