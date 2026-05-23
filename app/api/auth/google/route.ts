import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { idToken } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'Google ID Token is required' }, { status: 400 });
        }

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: [
                process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
                process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
                GOOGLE_CLIENT_ID || '',
            ].filter(Boolean)
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return NextResponse.json({ error: 'Invalid Google Token' }, { status: 400 });
        }

        const email = payload.email;
        const name = payload.name || 'Guest User';
        const picture = payload.picture || '';

        // Find or create guest user
        let user = await prisma.guest.findUnique({
            where: { email }
        });

        if (!user) {
            user = await prisma.guest.create({
                data: {
                    email,
                    name,
                    phone: '', 
                    profileImage: picture,
                    status: 'ACTIVE',
                    source: 'GOOGLE',
                }
            });
        } else if (!user.profileImage && picture) {
            user = await prisma.guest.update({
                where: { id: user.id },
                data: { profileImage: picture }
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: 'GUEST' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage
            }
        });

    } catch (error: any) {
        console.error('[GOOGLE_LOGIN_ERROR]', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
