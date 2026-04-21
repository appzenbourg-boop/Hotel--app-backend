import { NextResponse } from 'next/server';
import twilio from 'twilio';

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
        return NextResponse.json({ error: error.message || 'Failed to send OTP' }, { status: 500 });
    }
}
