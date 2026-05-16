import admin from 'firebase-admin';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

if (!admin.apps.length) {
  try {
    if (!firebaseConfig.projectId || !firebaseConfig.privateKey) {
       console.warn('Firebase Admin: Missing credentials in environment variables.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
      });
      console.log('Firebase Admin Initialized successfully ✅');
    }
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error ❌:', error.message);
  }
}

export const auth = admin.auth();
export default admin;
