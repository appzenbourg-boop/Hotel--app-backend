import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { phone, otp, idToken, platform } = await request.json();

    const requestPlatform = request.headers.get('x-platform') || platform;

    let normalizedPhone = phone ? phone.replace(/^\+91/, '').trim() : '';

    if (idToken) {
      // Firebase ID Token Verification
      const { getFirebaseAuth } = await import('@/lib/firebase');
      const auth = getFirebaseAuth(requestPlatform);
      
      const decodedToken = await auth.verifyIdToken(idToken);
      if (!decodedToken.phone_number) {
        return NextResponse.json({ error: 'No phone number found in token' }, { status: 400 });
      }
      
      normalizedPhone = decodedToken.phone_number.replace(/^\+91/, '').trim();
    } else {
      if (!phone || !otp) {
        return NextResponse.json({ error: 'Phone number and OTP (or idToken) are required' }, { status: 400 });
      }

      // 1. Look up the OTP record
      const otpRecord = await prisma.otpVerification.findUnique({
        where: { phone: normalizedPhone }
      });

      if (!otpRecord) {
        return NextResponse.json({ error: 'No OTP requested for this number' }, { status: 400 });
      }

      // 2. Validate Expiry
      if (otpRecord.expiresAt < new Date()) {
        await prisma.otpVerification.delete({ where: { phone: normalizedPhone } });
        return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 });
      }

      // 3. Validate Attempts
      if (otpRecord.attempts >= 3) {
        await prisma.otpVerification.delete({ where: { phone: normalizedPhone } });
        return NextResponse.json({ error: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 });
      }

      // 4. Validate OTP match
      const isValid = await bcrypt.compare(otp.toString(), otpRecord.otpHash);
      
      if (!isValid) {
        await prisma.otpVerification.update({
          where: { phone: normalizedPhone },
          data: { attempts: otpRecord.attempts + 1 }
        });
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }

      // 5. Success! Delete the one-time use OTP record
      await prisma.otpVerification.delete({ where: { phone: normalizedPhone } });
    }

    // 6. Identify the User in the Hotel Database
    const phoneSuffix = normalizedPhone.slice(-10);
    
    const user = await prisma.user.findFirst({ 
      where: { 
        phone: { contains: phoneSuffix } 
      } 
    });

    if (user) {
      // Existing User: Log them in
      const token = signToken({ id: user.id, role: user.role });
      
      const existingGuest = await prisma.guest.findFirst({ 
        where: { phone: { contains: phoneSuffix } } 
      });

      return NextResponse.json({
        success: true,
        isNewUser: false,
        token,
        user: { 
            id: user.id, 
            name: user.name, 
            phone: user.phone, 
            role: user.role,
            profileImage: existingGuest?.profileImage || null
        },
      });
    } else {
      // New User: Phone verified, proceed to registration
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Phone verified successfully',
        verifiedPhone: normalizedPhone
      });
    }

  } catch (error: any) {
    console.error('Verify OTP Route Error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
