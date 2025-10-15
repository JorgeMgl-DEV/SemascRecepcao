// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function missingEnv(_name: string, val: unknown) {
    return !val || (typeof val === 'string' && val.trim() === '')
}

const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missing = Object.entries(cfg).filter(([k, v]) => missingEnv(k, v)).map(([k]) => k)

if (missing.length > 0) {
    // Do not throw during import — export a flag and log a helpful message.
    console.error(`[firebase] missing env vars: ${missing.join(', ')}. ` +
        'Set VITE_FIREBASE_* variables or provide a .env file. Firebase initialization will be skipped.')
}

let app: ReturnType<typeof initializeApp> | null = null
let auth: ReturnType<typeof getAuth> | null = null
let db: ReturnType<typeof getFirestore> | null = null
let firebaseInitialized = false

try {
    if (missing.length === 0) {
        app = initializeApp(cfg)
        auth = getAuth(app)
        db = getFirestore(app)
        firebaseInitialized = true
    }
} catch (e) {
    // initialization failed (e.g. invalid config) — surface error but don't crash the app
    // so pages can show friendly errors instead of raw exceptions on reload.
    console.error('[firebase] initialization error:', e)
}

export { app, auth, db, firebaseInitialized }
