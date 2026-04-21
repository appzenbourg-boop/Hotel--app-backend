import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone number and verification code are required' }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid!)
      .verificationChecks.create({ to: formattedPhone, code });

    if (verificationCheck.status === 'approved') {
      // Look up user in the shared users table
      const user = await prisma.user.findFirst({ where: { phone } });

      if (user) {
        const token = signToken({ id: user.id, role: user.role });
        return NextResponse.json({
          success: true,
          isNewUser: false,
          token,
          user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
        });
      } else {
        return NextResponse.json({
          success: true,
          isNewUser: true,
          message: 'Phone verified successfully',
        });
      }
    }

    return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
  } catch (error: any) {
    console.error('Twilio Verify OTP Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to verify OTP' }, { status: 500 });
  }
}
