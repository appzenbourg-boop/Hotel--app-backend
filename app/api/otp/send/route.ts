import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { phone } = await request.json();

        if (!phone || typeof phone !== 'string') {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Validate Indian phone number (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        // Support +91 or just 10 digits
        const normalizedPhone = phone.replace(/^\+91/, '').trim();

        if (!phoneRegex.test(normalizedPhone)) {
            return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
        }

        // Rate Limiting & Abuse Prevention
        const existingOtp = await prisma.otpVerification.findUnique({
            where: { phone: normalizedPhone }
        });

        if (existingOtp) {
            // Check if it was requested very recently (e.g. within last 1 min)
            const timeSinceLastRequest = Date.now() - existingOtp.createdAt.getTime();
            if (timeSinceLastRequest < 60 * 1000) {
                return NextResponse.json({ error: 'Please wait before requesting another OTP' }, { status: 429 });
            }

            // Check if too many attempts
            if (existingOtp.attempts >= 3) {
                // If it's expired, we can allow a new one
                if (existingOtp.expiresAt > new Date()) {
                    return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
                }
            }
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Store OTP
        await prisma.otpVerification.upsert({
            where: { phone: normalizedPhone },
            update: {
                otpHash,
                expiresAt,
                attempts: 0,
                createdAt: new Date(),
            },
            create: {
                phone: normalizedPhone,
                otpHash,
                expiresAt,
                attempts: 0,
            }
        });

        // Send OTP via Fast2SMS
        const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
        if (!FAST2SMS_API_KEY) {
            console.error('FAST2SMS_API_KEY is not configured');
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }

        const fast2smsResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
                'authorization': FAST2SMS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                route: 'otp',
                variables_values: otp,
                numbers: normalizedPhone
            })
        });

        const fast2smsData = await fast2smsResponse.json();

        if (!fast2smsResponse.ok || !fast2smsData.return) {
            console.error('Fast2SMS Error:', fast2smsData);
            return NextResponse.json({ error: 'Failed to send OTP SMS' }, { status: 500 });
        }

        console.log(`[Fast2SMS] OTP sent successfully to: ${normalizedPhone}`);

        return NextResponse.json({ 
            success: true, 
            message: 'OTP sent successfully',
            provider: 'fast2sms',
            phone: normalizedPhone
        });

    } catch (error: any) {
        console.error('OTP Send Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
