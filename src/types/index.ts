import type { Timestamp } from 'firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

/** Sohbet turu: aile grubu ya da iki kisi arasinda. */
export type ChatType = 'group' | 'direct';

export interface Chat {
  id: string;
  type: ChatType;
  /** Grup sohbetinin adi; birebir sohbetlerde bos, karsi tarafin adi gosterilir. */
  name: string;
  members: string[];
  lastMessage?: { text: string; senderName: string; at: Timestamp | null } | null;
  updatedAt?: Timestamp | null;
}

/** Kullanicinin kendi belirledigi gorunum tercihleri. */
export interface UserSettings {
  /** Hazir arka plan kimligi ya da yuklenen resmin adresi. */
  chatBackground?: string | null;
  /** Uygulamanin ana rengi (baslik cubugu, dugmeler, vurgular). */
  appColor?: string | null;
  /** Kendi mesaj balonlarinin rengi. */
  bubbleColor?: string | null;
  /** Gelen fotograf ve videolar telefon galerisine de kaydedilsin mi? */
  saveToGallery?: boolean;
}

export interface FamilyUser {
  uid: string;
  /** Sohbette gorunen takma ad. */
  displayName: string;
  email: string;
  photoURL?: string | null;
  pushToken?: string | null;
  lastSeen?: Timestamp | null;
  settings?: UserSettings;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  /** Metin mesajlarinin icerigi, medya mesajlarinda alt yazi olarak kullanilir. */
  text: string;
  /** image / video / audio mesajlari icin dosya adresi. */
  mediaUrl?: string | null;
  /** Videolarda ilk kareden uretilen onizleme adresi. */
  thumbUrl?: string | null;
  /** Belge mesajlarinda dosya adi ve boyutu. */
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: Timestamp | null;
  readBy: string[];
}

export type CallType = 'video' | 'audio';

/** Aramanin yasam dongusu: caliyor -> kabul edildi -> bitti. */
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  type: CallType;
  status: CallStatus;
  /** Arayan tarafin baglanti teklifi. */
  offer?: { type: string; sdp: string } | null;
  /** Aranan tarafin yaniti. */
  answer?: { type: string; sdp: string } | null;
  createdAt: Timestamp | null;
  /** Aramanin kabul edildigi an; sure hesabinda kullanilir. */
  acceptedAt?: Timestamp | null;
  endedAt?: Timestamp | null;
}
