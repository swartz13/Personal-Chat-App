import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { registerForPushNotifications } from '../services/notifications';
import type { FamilyUser } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: FamilyUser | null;
  /** Remains true until the initial session check is complete. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FamilyUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) setProfile(null);
      setInitializing(false);
    });
  }, []);

  // Create the user document and listen to its changes when logged in.
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);

    /**
     * If the document is created for the first time, a default name is written.
     * If the document already exists, alias and profile picture are UNTOUCHED; otherwise
     * changes made by the user in settings were reverted on every launch.
     */
    (async () => {
      try {
        const existing = await getDoc(userRef);
        if (!existing.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName || (user.email ?? '').split('@')[0],
            photoURL: null,
            lastSeen: serverTimestamp(),
          });
          return;
        }
        await setDoc(
          userRef,
          { uid: user.uid, email: user.email ?? '', lastSeen: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.warn('[auth] could not write user document', error);
      }
    })();

    // Save the notification token. If it fails, the application continues to work.
    registerForPushNotifications(user.uid).catch((error) =>
      console.warn('[auth] could not register for notifications', error)
    );

    return onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) setProfile(snapshot.data() as FamilyUser);
      },
      (error) => console.warn('[auth] could not listen to user document', error)
    );
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initializing,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      logOut: () => signOut(auth),
    }),
    [user, profile, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth can only be used within an AuthProvider');
  return context;
}
