import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, phone, password, email } = await request.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'Name, phone and password are required' }, { status: 400 });
    }

    // Check if user already exists — same users table as admin panel
    const existingUser = await prisma.user.findFirst({ where: { phone } });
    if (existingUser) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with GUEST role — visible in admin panel's user list
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        email: email || `${phone}@guest.zenbourg.com`,
        role: 'GUEST',
        status: 'ACTIVE',
      },
    });

    // Also create Guest profile if not already there — admin panel reads from guests table
    const existingGuest = await prisma.guest.findUnique({ where: { phone } });
    if (!existingGuest) {
      await prisma.guest.create({
        data: {
          name,
          phone,
          email: email || null,
          checkInStatus: 'PENDING',
        },
      });
    }

    const token = signToken({ id: user.id, role: user.role });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
