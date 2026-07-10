import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Check if default (Android) Firebase app is initialized
if (!getApps().length) {
    try {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID as string,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') as string,
            }),
        });
        console.log('[FIREBASE] Default (Android) app initialized successfully');
    } catch (error) {
        console.error('[FIREBASE] Error initializing default app', error);
    }
}

// Check if iOS Firebase app is initialized
if (!getApps().some((app) => app?.name === 'ios')) {
    try {
        if (
            process.env.IOS_FIREBASE_PROJECT_ID &&
            process.env.IOS_FIREBASE_CLIENT_EMAIL &&
            process.env.IOS_FIREBASE_PRIVATE_KEY
        ) {
            initializeApp(
                {
                    credential: cert({
                        projectId: process.env.IOS_FIREBASE_PROJECT_ID,
                        clientEmail: process.env.IOS_FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.IOS_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    }),
                },
                'ios'
            );
            console.log('[FIREBASE] iOS app initialized successfully');
        }
    } catch (error) {
        console.error('[FIREBASE] Error initializing iOS app', error);
    }
}

/**
 * Returns the appropriate Firebase Auth instance based on the platform.
 * @param platform 'ios' | 'android' | undefined
 */
export const getFirebaseAuth = (platform?: string) => {
    if (platform?.toLowerCase() === 'ios') {
        const iosApp = getApps().find((app) => app?.name === 'ios');
        if (iosApp) {
            return getAuth(iosApp);
        }
        console.warn('[FIREBASE] iOS app not initialized, falling back to default');
    }
    return getAuth();
};

