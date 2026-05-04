import { NextResponse } from 'next/server';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(request: Request) {
    try {
        const { phone } = await request.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const client = twilio(accountSid, authToken);
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

        // TEST MODE BYPASS
        if (phone === '9000000000' || phone === '+919000000000') {
            console.log('Test Mode: Skipping Twilio for phone', phone);
            return NextResponse.json({ 
                success: true, 
                message: 'OTP sent successfully (Test Mode)',
                status: 'pending' 
            });
        }

        // Verify service only SMS
        const verification = await client.verify.v2
            .services(verifyServiceSid!)
            .verifications.create({ to: formattedPhone, channel: 'sms' });

        return NextResponse.json({ 
            success: true, 
            message: 'OTP sent successfully',
            status: verification.status 
        });

    } catch (error: any) {
        console.error('Twilio Send OTP Error:', error);
        
        // FAIL-SAFE: If Twilio fails, return a fallback OTP so the user can see it on screen
        const fallbackOtp = '123456'; 
        
        return NextResponse.json({ 
            success: true, 
            message: 'OTP bypass active (Twilio: ' + (error.message || 'Error') + ')',
            otp: fallbackOtp,
            isFallback: true 
        });
    }
}
