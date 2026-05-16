import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { idToken, phone } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Firebase idToken is required' }, { status: 400 });
    }

    // 1. Verify the Firebase Token via Admin SDK
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (verifyError: any) {
      console.error('Firebase Token Verification Failed:', verifyError.message);
      return NextResponse.json({ error: 'Invalid or expired Firebase token' }, { status: 401 });
    }

    const verifiedPhone = decodedToken.phone_number;

    if (!verifiedPhone) {
      return NextResponse.json({ error: 'Token verified but no phone number found' }, { status: 401 });
    }

    // 2. Identify the User in the Hotel Database
    // Note: We use the verified phone from the token as the source of truth.
    // We match the last 10 digits to handle varying country code formats.
    const phoneSuffix = verifiedPhone.slice(-10);
    
    const user = await prisma.user.findFirst({ 
      where: { 
        phone: { contains: phoneSuffix } 
      } 
    });

    if (user) {
      // Existing User: Log them in
      const token = signToken({ id: user.id, role: user.role });
      
      return NextResponse.json({
        success: true,
        isNewUser: false,
        token,
        user: { 
            id: user.id, 
            name: user.name, 
            phone: user.phone, 
            role: user.role 
        },
      });
    } else {
      // New User: Phone verified, proceed to registration
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Phone verified successfully via Firebase',
        verifiedPhone
      });
    }

  } catch (error: any) {
    console.error('Verify OTP Route Error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
