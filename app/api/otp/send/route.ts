import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * For Firebase Phone Auth, the SMS is triggered directly from the client (mobile/web).
 * This endpoint remains to provide a consistent API for the client to signal intent
 * or for the backend to perform any pre-verification checks (e.g. rate limiting).
 */
export async function POST(request: Request) {
    try {
        const { phone } = await request.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        console.log(`[Firebase OTP] Client initiating SMS for: ${phone}`);

        return NextResponse.json({ 
            success: true, 
            message: 'Initiate Firebase Phone Auth on the client side',
            provider: 'firebase',
            phone
        });

    } catch (error: any) {
        console.error('OTP Send Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
