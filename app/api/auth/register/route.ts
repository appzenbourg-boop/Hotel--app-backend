import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, phone, password, email, referralCode } = await request.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'Name, phone and password are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { phone },
          { email: email || 'never-match-this' }
        ]
      } 
    });

    if (existingUser) {
      if (existingUser.phone === phone) {
        return NextResponse.json({ error: 'Phone number already registered' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Email address already registered' }, { status: 400 });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await prisma.guest.findFirst({ where: { referralCode } });
      if (!referrer) {
        return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code for new user
    const newUserReferralCode = `${name.slice(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;

    // Create user
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

    // Create Guest profile
    const guest = await prisma.guest.create({
      data: {
        name,
        phone,
        email: email || null,
        checkInStatus: 'PENDING',
        referralCode: newUserReferralCode,
        referredBy: referralCode || null,
      },
    });

    // Create Wallet
    await prisma.wallet.create({
      data: {
        guestId: guest.id,
        balance: 0,
      },
    });

    // If referred, create pending referral record
    if (referrer) {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: guest.id,
          code: referralCode,
          status: 'PENDING',
          rewardAmount: 100,
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
    return NextResponse.json({ 
      error: 'Failed to create account', 
      details: error.message,
      code: error.code 
    }, { status: 500 });
  }
}
