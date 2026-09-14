/**
 * Tests the notification infrastructure from end to end:
 *   npm run test-notifications -- email password
 *
 * Reads the registered notification address on the user's phone from Firestore,
 * sends a test notification via Expo's service, and queries the delivery result.
 * This makes it clear where the error is (missing address / FCM setup missing /
 * phone denied permission).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, getFirestore, terminate } from 'firebase/firestore';

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`    \x1b[90m${m}\x1b[0m`);

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  fail('Usage: npm run test-notifications -- email@example.com password');
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);

console.log('\n\x1b[1m1) Login\x1b[0m');
const result = await signInWithEmailAndPassword(getAuth(app), email, password);
ok(`logged in: ${result.user.email}`);

console.log('\n\x1b[1m2) Notification address\x1b[0m');
const userDoc = await getDoc(doc(db, 'users', result.user.uid));
const token = userDoc.data()?.pushToken;

if (!token) {
  fail('No registered notification address for this account.');
  info('You need to open the app on the phone and approve the notification permission.');
  await terminate(db);
  process.exit(1);
}
ok(`address found: ${token}`);

console.log('\n\x1b[1m3) Sending notification\x1b[0m');
const sendResponse = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify([
    {
      to: token,
      title: 'Family Chat',
      body: 'This is a test notification 👋',
      sound: 'default',
      channelId: 'messages',
      priority: 'high',
    },
  ]),
});

const response = await sendResponse.json();
const ticket = response?.data?.[0];

if (ticket?.status !== 'ok') {
  fail(`failed to send: ${ticket?.message ?? JSON.stringify(response).slice(0, 200)}`);
  const errorType = ticket?.details?.error;
  if (errorType === 'DeviceNotRegistered') {
    info('The address on the phone is invalid. You need to reopen the app and refresh the address.');
  } else if (errorType) {
    info(`Expo error type: ${errorType}`);
  }
  await terminate(db);
  process.exit(1);
}
ok(`accepted (ticket: ${ticket.id})`);

console.log('\n\x1b[1m4) Delivery result\x1b[0m');
info('Waiting 6 seconds for Expo to complete delivery...');
await new Promise((r) => setTimeout(r, 6000));

const receipt = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ ids: [ticket.id] }),
});
const receiptData = await receipt.json();
const entry = receiptData?.data?.[ticket.id];

if (!entry) {
  info('Result is not ready yet. Check the phone.');
} else if (entry.status === 'ok') {
  ok('notification delivered to phone');
} else {
  fail(`failed to deliver: ${entry.message}`);
  const errorType = entry?.details?.error;
  if (errorType === 'MismatchSenderId') {
    info('FCM key does not belong to this app. google-services.json and the key in Expo must be from the same project.');
  } else if (errorType === 'DeviceNotRegistered') {
    info('App uninstalled from phone or address is stale.');
  } else if (errorType) {
    info(`Expo error type: ${errorType}`);
  }
}

await terminate(db);
process.exit(0);
