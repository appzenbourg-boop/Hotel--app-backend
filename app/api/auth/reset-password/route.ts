import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { phone, password, verified } = await request.json();

    if (!verified) {
      return NextResponse.json({ error: 'Cannot reset password without verifying OTP.' }, { status: 400 });
    }

    // Find user in the shared users table
    const existingUser = await prisma.user.findFirst({ where: { phone } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User with this phone not found.' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully!' });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
