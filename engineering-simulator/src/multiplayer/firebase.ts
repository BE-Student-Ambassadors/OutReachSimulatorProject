import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

/**
 * Firebase web config for the `sequoia-eng-lab` project. These values are public by design:
 * access is controlled by firebase/firestore.rules, not by hiding this config.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBoRormLga_OB6tt5FJRGC3e6FaP3-PAmY',
  authDomain: 'sequoia-eng-lab.firebaseapp.com',
  projectId: 'sequoia-eng-lab',
  storageBucket: 'sequoia-eng-lab.firebasestorage.app',
  messagingSenderId: '289354703159',
  appId: '1:289354703159:web:9f741c069dfeddc4327ab2',
}

/** Set VITE_FIREBASE_EMULATORS=1 (e.g. `npm run dev:mp`) to use the local emulators instead of production. */
export const usingEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === '1'

// In emulator mode use a demo- project id so nothing can ever reach the real project.
export const app = getApps().length ? getApp() : initializeApp(usingEmulators ? { ...firebaseConfig, projectId: 'demo-sequoia' } : firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // Emulator-only shortcut for browser automation: sign in as a fake Google account.
  ;(window as unknown as { __emuGoogle?: (email: string) => Promise<unknown> }).__emuGoogle = (email) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name: 'Test Instructor' })))
}
