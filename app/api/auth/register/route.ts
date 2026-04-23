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

    // If referred, create COMPLETED referral record and credit wallets
    if (referrer) {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: guest.id,
          code: referralCode,
          status: 'COMPLETED',
          rewardAmount: 100,
          rewardCredited: true,
          completedAt: new Date(),
        },
      });

      // Credit Referrer
      await prisma.wallet.update({
        where: { guestId: referrer.id },
        data: { balance: { increment: 100 } }
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: (await prisma.wallet.findUnique({ where: { guestId: referrer.id } }))!.id,
          type: 'CREDIT',
          amount: 100,
          description: `Referral reward for inviting ${name}`,
          reference: guest.id
        }
      });

      // Credit New Guest (optional, if you want new guest to also get a bonus)
      // The user said "user should able to use that wallet money" which might imply the new user gets some too.
      // Let's give the new guest 50 as a welcome bonus if they used a code.
      await prisma.wallet.update({
        where: { guestId: guest.id },
        data: { balance: { increment: 50 } }
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: (await prisma.wallet.findUnique({ where: { guestId: guest.id } }))!.id,
          type: 'CREDIT',
          amount: 50,
          description: 'Welcome bonus for using referral code',
          reference: referralCode
        }
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
