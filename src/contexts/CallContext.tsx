import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import {
  createCall,
  endCall,
  subscribeToCall,
  subscribeToIncomingCalls,
} from '../services/calls';
import { notifyUser } from '../services/notifications';
import type { Call, CallType } from '../types';

/** Active call displayed on the screen. */
interface ActiveCall {
  callId: string;
  isCaller: boolean;
  type: CallType;
  peerName: string;
}

interface CallContextValue {
  incomingCall: Call | null;
  activeCall: ActiveCall | null;
  startCall: (callee: { uid: string; name: string }, type: CallType) => Promise<void>;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  closeActiveCall: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  const myName = profile?.displayName || user?.displayName || 'Me';

  // Watch for incoming ringing calls.
  useEffect(() => {
    if (!user) {
      setIncomingCall(null);
      return;
    }
    return subscribeToIncomingCalls(user.uid, (call) => {
      // Do not show a new call if a conversation is already ongoing.
      setIncomingCall((prev) => {
        if (activeCall) return null;
        return call ?? null;
      });
    });
  }, [user, activeCall]);

  // Close the incoming call screen if the caller gives up.
  useEffect(() => {
    if (!incomingCall) return;
    return subscribeToCall(incomingCall.id, (call) => {
      if (!call || call.status !== 'ringing') setIncomingCall(null);
    });
  }, [incomingCall?.id]);

  const startCall = useCallback(
    async (callee: { uid: string; name: string }, type: CallType) => {
      if (!user) return;

      // Prevent calling oneself
      if (callee.uid === user.uid) {
        Alert.alert(t('call.failed'), t('call.cannotCallSelf'));
        return;
      }

      // Check whether callee is currently signed in
      try {
        const calleeSnap = await getDoc(doc(db, 'users', callee.uid));
        const calleeData = calleeSnap.data();
        const isOnline = Boolean(calleeData?.isLoggedIn && calleeData?.pushToken);

        if (!isOnline) {
          Alert.alert(
            t('call.userOfflineTitle'),
            t('call.userOffline', { name: callee.name })
          );
          return;
        }
      } catch (checkErr) {
        console.warn('[call] could not verify callee presence', checkErr);
      }

      try {
        const callId = await createCall({ uid: user.uid, name: myName }, callee, type);
        setActiveCall({ callId, isCaller: true, type, peerName: callee.name });

        // Notification goes ONLY to the callee; not to the whole group.
        await notifyUser(
          callee.uid,
          myName,
          type === 'video' ? '📹 Video calling' : '📞 Voice calling',
          true,
          { callId, isCall: true }
        );
      } catch (error) {
        console.warn('[call] could not be started', error);
        Alert.alert(t('call.failed'), t('call.failedHint'));
      }
    },
    [user, myName, t]
  );

  const acceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    setActiveCall({
      callId: incomingCall.id,
      isCaller: false,
      type: incomingCall.type,
      peerName: incomingCall.callerName,
    });
    setIncomingCall(null);
  }, [incomingCall]);

  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    endCall(incomingCall.id, 'rejected');
    setIncomingCall(null);
  }, [incomingCall]);

  const closeActiveCall = useCallback(() => setActiveCall(null), []);

  const value = useMemo<CallContextValue>(
    () => ({ incomingCall, activeCall, startCall, acceptIncoming, rejectIncoming, closeActiveCall }),
    [incomingCall, activeCall, startCall, acceptIncoming, rejectIncoming, closeActiveCall]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall can only be used within a CallProvider');
  return context;
}
