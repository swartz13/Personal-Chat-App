import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Call, CallType } from '../types';

/**
 * Audio and video calls are established directly between phones (WebRTC).
 * Audio and video do not pass through the server. Firestore only serves to
 * exchange the connection information needed for two phones to find each other.
 */

/**
 * STUN servers allow the phone to discover its public IP address.
 * On some mobile operators this is not enough; in that case the connection is
 * relayed via TURN. The following TURN addresses are public free services.
 */
export const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

function callsRef() {
  return collection(db, 'calls');
}

/** The caller creates a new call record. */
export async function createCall(
  caller: { uid: string; name: string },
  callee: { uid: string; name: string },
  type: CallType
): Promise<string> {
  const docRef = await addDoc(callsRef(), {
    callerId: caller.uid,
    callerName: caller.name,
    calleeId: callee.uid,
    calleeName: callee.name,
    type,
    status: 'ringing',
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    endedAt: null,
  });
  return docRef.id;
}

/** Saves the caller's connection offer. */
export async function setOffer(callId: string, offer: { type: string; sdp: string }) {
  await updateDoc(doc(db, 'calls', callId), { offer });
}

/** Saves the callee's answer and marks the call as accepted. */
export async function setAnswer(callId: string, answer: { type: string; sdp: string }) {
  await updateDoc(doc(db, 'calls', callId), {
    answer,
    status: 'accepted',
    // Call duration is measured from this moment.
    acceptedAt: serverTimestamp(),
  });
}

/** Ends the call. Both parties see this status and close the connection. */
export async function endCall(callId: string, status: 'ended' | 'rejected' | 'missed' = 'ended') {
  await updateDoc(doc(db, 'calls', callId), { status, endedAt: serverTimestamp() }).catch((error) =>
    console.warn('[call] could not be ended', error)
  );
}

/** Live tracks the status of a single call. */
export function subscribeToCall(callId: string, onChange: (call: Call | null) => void) {
  return onSnapshot(
    doc(db, 'calls', callId),
    (snapshot) => onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Call) : null),
    (error) => {
      console.warn('[call] could not be tracked', error);
      onChange(null);
    }
  );
}

/**
 * Tracks incoming ringing calls for this user.
 * This listener triggers the incoming call screen while the app is open.
 */
export function subscribeToIncomingCalls(uid: string, onCall: (call: Call | null) => void) {
  const q = query(callsRef(), where('calleeId', '==', uid), where('status', '==', 'ringing'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onCall(null);
        return;
      }
      // If there is more than one, show the newest.
      const calls = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Call)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      onCall(calls[0]);
    },
    (error) => console.warn('[call] incoming calls could not be tracked', error)
  );
}

/** ICE candidate: one of the network addresses where the phone is reachable. */
export async function addIceCandidate(
  callId: string,
  side: 'caller' | 'callee',
  candidate: object
) {
  await addDoc(collection(db, 'calls', callId, `${side}Candidates`), candidate).catch((error) =>
    console.warn('[call] candidate could not be added', error)
  );
}

/** Live listens to the network addresses of the other party. */
export function subscribeToIceCandidates(
  callId: string,
  side: 'caller' | 'callee',
  onCandidate: (candidate: any) => void
) {
  return onSnapshot(
    collection(db, 'calls', callId, `${side}Candidates`),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') onCandidate(change.doc.data());
      });
    },
    (error) => console.warn('[call] candidates could not be tracked', error)
  );
}

/**
 * Cleans up records of ended calls.
 * Called when the call ends to prevent unnecessary accumulation in Firestore.
 */
export async function cleanupCall(callId: string) {
  try {
    const batch = writeBatch(db);
    for (const side of ['callerCandidates', 'calleeCandidates']) {
      const candidates = await getDocs(collection(db, 'calls', callId, side));
      candidates.forEach((candidate) => batch.delete(candidate.ref));
    }
    await batch.commit();
  } catch (error) {
    console.warn('[call] cleanup could not be performed', error);
  }
}

/**
 * Deletes a call record from history.
 * Security rules only allow the parties of the call.
 */
export async function deleteCallRecord(callId: string) {
  for (const side of ['callerCandidates', 'calleeCandidates']) {
    const candidates = await getDocs(collection(db, 'calls', callId, side));
    await Promise.all(candidates.docs.map((candidate) => deleteDoc(candidate.ref).catch(() => {})));
  }
  await deleteDoc(doc(db, 'calls', callId));
}

/** Fetches other members in the chat (people who can be called). */
export async function listOtherMembers(chatId: string, uid: string) {
  const chatDoc = await getDoc(doc(db, 'chats', chatId));
  const members: string[] = chatDoc.data()?.members ?? [];

  const usersSnapshot = await getDocs(collection(db, 'users'));
  return usersSnapshot.docs
    .map((d) => d.data() as { uid: string; displayName: string })
    .filter((userDoc) => members.includes(userDoc.uid) && userDoc.uid !== uid);
}

/** Title text to be used for the incoming call notification. */
export function callNotificationBody(type: CallType) {
  return type === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call';
}
