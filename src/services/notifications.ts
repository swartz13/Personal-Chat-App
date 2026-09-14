import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Notifications work serverless.
 *
 * Normally, a server (Cloud Functions) is required to send notifications when a message arrives;
 * which requires a paid plan. Instead, the phone sending the message reads the
 * notification addresses of other members from Firestore and sends a direct request
 * to Expo's free push notification service.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/**
 * Channel for call notifications. Because channel settings cannot be
 * changed later on Android, the ID also changes whenever the sound behavior changes.
 */
/**
 * The call channel is created on the NATIVE side (plugins/withRingtoneChannel.js)
 * because only there the real phone ringtone can be assigned.
 * It should not be recreated from here; otherwise the sound reverts to a notification sound.
 */
export const CALL_CHANNEL = 'aramalar_zil_sistem';

/** Channel for message notifications. */
export const MESSAGE_CHANNEL = 'messages';

/**
 * How notifications arriving while the app is open will be shown.
 *
 * We don't show message notifications while the screen is on: the user is already
 * inside the app and sees the message directly. Calls, however, are shown in all cases,
 * because the ringtone comes from this notification.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data as any) ?? {};
    const isCall = Boolean(data.isCall);
    const targetUid = data.targetUid || data.calleeUid;

    // Security check: if the notification specifies a targetUid (e.g. personal call or direct message),
    // ensure current signed-in user matches. If logged out or signed into another account on this phone, suppress!
    const currentUid = auth.currentUser?.uid;
    if (targetUid && (!currentUid || currentUid !== targetUid)) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    const isAppOpen = AppState.currentState === 'active';
    const shouldShow = isCall || !isAppOpen;

    return {
      shouldShowBanner: shouldShow,
      shouldShowList: true,
      shouldPlaySound: shouldShow,
      shouldSetBadge: false,
    };
  },
});

/**
 * A channel must be defined for notifications to appear on Android.
 * We use a separate channel for calls: the phone ringtone plays,
 * it vibrates longer and is shown with the highest priority.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL, {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#128C7E',
    // The phone's own notification sound is used.
    sound: 'default',
  });

  // Clear channels left from previous attempts: because an Android channel's
  // sound setting cannot be changed later, the old ones were getting stuck.
  for (const old of ['aramalar', 'aramalar_zil_v2', 'aramalar_sistem_v3', 'mesajlar']) {
    await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
  }

  // CALL_CHANNEL is NOT CREATED here; it is set up with the phone's ringtone
  // on the native side during app startup.
}

/** Finds the EAS project ID in app.json; needed to get a notification token. */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined
  );
}

/**
 * Requests notification permissions, gets the device's notification token and writes it to the user document.
 * If it fails, the rest of the app continues to work; only
 * notifications won't arrive.
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notification] Push token cannot be obtained on an emulator.');
    return null;
  }

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') {
    console.warn('[notification] permission not granted');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notification] EAS project ID not found; "npx eas init" should be run.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await setDoc(doc(db, 'users', uid), { pushToken: token, isLoggedIn: true }, { merge: true });
    return token;
  } catch (error) {
    console.warn('[notification] token could not be obtained', error);
    return null;
  }
}

/** Collects the notification tokens of the given users. */
async function collectTokens(uids: string[]): Promise<string[]> {
  const docs = await Promise.all(
    uids.map((uid) => getDoc(doc(db, 'users', uid)).catch(() => null))
  );

  return docs
    .map((d) => d?.data()?.pushToken)
    .filter(
      (token): token is string =>
        typeof token === 'string' && token.startsWith('ExponentPushToken')
    );
}

/** Sends prepared notifications to Expo's service. */
async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  isCall: boolean,
  data: Record<string, unknown>
) {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    channelId: isCall ? CALL_CHANNEL : MESSAGE_CHANNEL,
    priority: 'high',
    data,
    // A call notification becomes irrelevant after 45 seconds.
    ...(isCall ? { ttl: 45 } : {}),
  }));

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.warn('[notification] could not be sent', response.status, (await response.text()).slice(0, 200));
    return;
  }

  const result = await response.json();
  for (const record of result?.data ?? []) {
    if (record?.status === 'error') {
      console.warn('[notification] recipient error', record?.message, record?.details?.error);
    }
  }
}

/**
 * Sends a notification to ONLY ONE person.
 * Used in one-on-one calls; previously it was going to the whole group.
 */
export async function notifyUser(
  targetUid: string,
  title: string,
  preview: string,
  isCall = false,
  data: Record<string, unknown> = {}
) {
  try {
    const tokens = await collectTokens([targetUid]);
    await sendPush(tokens, title, preview, isCall, {
      ...data,
      targetUid,
      calleeUid: targetUid,
    });
  } catch (error) {
    console.warn('[notification] error during sending', error);
  }
}

/**
 * Sends a notification to other members in a chat.
 * In a one-on-one chat it only goes to the other party, in a group chat to all members.
 */
export async function notifyOthers(
  chatId: string,
  sender: { uid: string; name: string },
  preview: string,
  isCall = false
) {
  try {
    const isDirect = chatId.startsWith('direct_');
    const isFamily = chatId === 'family';

    let recipients: string[] = [];
    let isGroup = false;
    let title = sender.name;

    if (isDirect) {
      // For direct chats (direct_uid1_uid2), recipient is strictly the other member
      const members = chatId.replace('direct_', '').split('_');
      recipients = members.filter((member) => member !== sender.uid);
      isGroup = false;
      title = sender.name;
    } else {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      const data = chatDoc.data();
      const members: string[] = data?.members ?? [];
      isGroup = isFamily || data?.type === 'group';
      recipients = members.filter((member) => member !== sender.uid);
      title = isGroup ? data?.name || 'Family Group' : sender.name;
    }

    if (recipients.length === 0) return;

    const tokens = await collectTokens(recipients);
    const body = isGroup ? `${sender.name}: ${preview}` : preview;

    // For direct chats with a single recipient, pass targetUid so that if multiple accounts
    // were used on the recipient's phone, only the active account receives it.
    const targetUid = !isGroup && recipients.length === 1 ? recipients[0] : undefined;

    await sendPush(tokens, title, body, isCall, {
      chatId,
      ...(targetUid ? { targetUid } : {}),
    });
  } catch (error) {
    console.warn('[notification] error during sending', error);
  }
}

/** Generates the short text to be shown in the notification based on the message type. */
export function buildPreview(type: string, text: string) {
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎥 Video';
  if (type === 'file') return '📎 Document';
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
