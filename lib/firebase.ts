import * as admin from 'firebase-admin';

// Check if default (Android) Firebase app is initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log('[FIREBASE] Default (Android) app initialized successfully');
    } catch (error) {
        console.error('[FIREBASE] Error initializing default app', error);
    }
}

// Check if iOS Firebase app is initialized
if (!admin.apps.some((app) => app?.name === 'ios')) {
    try {
        if (
            process.env.IOS_FIREBASE_PROJECT_ID &&
            process.env.IOS_FIREBASE_CLIENT_EMAIL &&
            process.env.IOS_FIREBASE_PRIVATE_KEY
        ) {
            admin.initializeApp(
                {
                    credential: admin.credential.cert({
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
 * @returns admin.auth.Auth
 */
export const getFirebaseAuth = (platform?: string) => {
    if (platform?.toLowerCase() === 'ios') {
        const iosApp = admin.apps.find((app) => app?.name === 'ios');
        if (iosApp) {
            return iosApp.auth();
        }
        console.warn('[FIREBASE] iOS app not initialized, falling back to default');
    }
    return admin.auth();
};

export default admin;
