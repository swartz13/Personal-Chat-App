import type { Timestamp } from 'firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

/** Chat type: family group or direct chat between two users. */
export type ChatType = 'group' | 'direct';

export interface Chat {
  id: string;
  type: ChatType;
  /** Group chat name; empty for direct chats where the other user's name is displayed. */
  name: string;
  members: string[];
  lastMessage?: { text: string; senderName: string; at: Timestamp | null } | null;
  updatedAt?: Timestamp | null;
}

export type SupportedLanguage = 'en' | 'tr' | 'ru';

/** User appearance and application preferences. */
export interface UserSettings {
  /** Background preset ID or custom uploaded image URL. */
  chatBackground?: string | null;
  /** Primary application color palette (header bar, buttons, accents). */
  appColor?: string | null;
  /** User's own chat message bubble color. */
  bubbleColor?: string | null;
  /** Automatically save received media to phone gallery when viewed. */
  saveToGallery?: boolean;
  /** Selected application language ('en' | 'tr' | 'ru'). */
  language?: SupportedLanguage;
}

export interface FamilyUser {
  uid: string;
  /** Display name shown in chat. */
  displayName: string;
  email: string;
  photoURL?: string | null;
  pushToken?: string | null;
  lastSeen?: Timestamp | null;
  settings?: UserSettings;
  /** If true, the user is marked disabled and hidden from chat lists. */
  disabled?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  /** Text message content, or caption for media messages. */
  text: string;
  /** File URL for image / video / audio messages. */
  mediaUrl?: string | null;
  /** Video thumbnail URL generated from the first frame. */
  thumbUrl?: string | null;
  /** File name and size in bytes for document messages. */
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: Timestamp | null;
  readBy: string[];
}

export type CallType = 'video' | 'audio';

/** Call lifecycle status: ringing -> accepted -> ended / missed. */
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  type: CallType;
  status: CallStatus;
  /** Caller connection offer (SDP). */
  offer?: { type: string; sdp: string } | null;
  /** Callee connection answer (SDP). */
  answer?: { type: string; sdp: string } | null;
  createdAt: Timestamp | null;
  /** Timestamp when call was accepted; used for duration calculation. */
  acceptedAt?: Timestamp | null;
  endedAt?: Timestamp | null;
}
