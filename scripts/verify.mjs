/**
 * Checks the Firebase setup from end to end.
 * To run: npm run verify
 *
 * Going through this before trying on the phone will help you find errors much faster.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  terminate,
} from 'firebase/firestore';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ok = (message) => console.log(`  \x1b[32m✓\x1b[0m ${message}`);
const fail = (message) => console.log(`  \x1b[31m✗\x1b[0m ${message}`);
const info = (message) => console.log(`    \x1b[90m${message}\x1b[0m`);
const step = (message) => console.log(`\n\x1b[1m${message}\x1b[0m`);

/** Knowing where we left off in the check, we exit. */
function exitWith(code) {
  process.exit(code);
}

// --- 1. Environment variables ---------------------------------------------------

step('1) .env file');

const requiredKeys = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

const missing = requiredKeys.filter((key) => !process.env[key]);

if (missing.length === requiredKeys.length) {
  fail('.env file not found or completely empty.');
  info('Solution: run cp .env.example .env command and follow SETUP.md step 5.');
  exitWith(1);
}

if (missing.length > 0) {
  fail(`These values are empty in .env: ${missing.join(', ')}`);
  info('Firebase console > Project settings > General > Your apps > Web app');
  exitWith(1);
}

ok('All Firebase settings are populated.');
info(`Project: ${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}`);

// --- 2. Connection -------------------------------------------------------------

step('2) Firebase connection');

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
ok('Firebase app initialized.');

// --- 3. Login ----------------------------------------------------------------

step('3) Login attempt');
info('We will log in with one of the accounts you created in SETUP.md step 2.');

/**
 * Gets credentials first from command line (npm run verify -- email password),
 * otherwise asks from terminal. If no terminal (called from another script)
 * reads two lines from stdin.
 */
async function getCredentials() {
  const [argEmail, argPassword] = process.argv.slice(2);
  if (argEmail && argPassword) {
    return { email: argEmail.trim(), password: argPassword };
  }

  if (stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    const email = (await rl.question('  Email: ')).trim();
    const password = await rl.question('  Password: ');
    rl.close();
    return { email, password };
  }

  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const lines = chunks.join('').split('\n');
  return { email: (lines[0] ?? '').trim(), password: lines[1] ?? '' };
}

const { email, password } = await getCredentials();

if (!email || !password) {
  fail('Email and password not entered.');
  info('Usage: npm run verify        (asks for credentials)');
  info('     or npm run verify -- email@family.local password');
  exitWith(1);
}

let user;
try {
  const result = await signInWithEmailAndPassword(auth, email, password);
  user = result.user;
  ok(`Login successful: ${user.email}`);
  console.log(`\n  \x1b[1m\x1b[36mUID: ${user.uid}\x1b[0m`);
  info('This UID must be in the members array in chats/family document.');
} catch (error) {
  const code = error?.code ?? '';
  fail(`Could not log in (${code || error?.message})`);
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    info('Account not created in Firebase console or password incorrect.');
    info('Check from Authentication > Users section.');
  } else if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    info('Email/Password sign-in method not enabled.');
    info('Authentication > Sign-in method > Email/Password > Enable.');
  } else if (code.includes('api-key')) {
    info('EXPO_PUBLIC_FIREBASE_API_KEY value in .env is incorrect.');
    info('Firebase console > Project settings > General > Web app > apiKey');
  } else if (code === 'auth/invalid-email') {
    info('Email address formatted incorrectly.');
  } else if (code === 'auth/network-request-failed') {
    info('Could not establish internet connection.');
  }
  exitWith(1);
}

// --- 4. Family chat ---------------------------------------------------------

step('4) chats/family document');

let members = [];
try {
  const chatDoc = await getDoc(doc(db, 'chats', 'family'));
  if (!chatDoc.exists()) {
    fail('chats/family document not found.');
    info('Follow SETUP.md step 4: create document with id family in chats collection.');
    exitWith(1);
  }
  members = chatDoc.data().members ?? [];
  if (!Array.isArray(members)) {
    fail('members field is not of type array.');
    info('Change type of members field to array in Firestore console.');
    exitWith(1);
  }
  ok(`Document found. Number of members: ${members.length}`);

  if (!members.includes(user.uid)) {
    fail('Your UID is not in the members list.');
    info(`Needs to be added: ${user.uid}`);
    info(`Currently in list: ${members.length ? members.join(', ') : '(empty)'}`);
    exitWith(1);
  }
  ok('UID is in members list — read access granted.');
} catch (error) {
  const code = error?.code ?? '';
  fail(`Chat document could not be read (${code || error?.message})`);
  if (code === 'permission-denied') {
    info('Security rules are blocking. There are two possibilities:');
    info('a) firebase/firestore.rules content not pasted to console and published.');
    info('b) UID is not in members list in chats/family document.');
  } else if (code === 'unavailable') {
    info('Firestore database might not have been created (Build > Firestore Database).');
  }
  exitWith(1);
}

// --- 5. Write permissions -------------------------------------------------------

step('5) Message sending test');

try {
  const testMessage = await addDoc(collection(db, 'chats', 'family', 'messages'), {
    senderId: user.uid,
    senderName: 'Setup test',
    type: 'text',
    text: 'This is a setup test, it will be deleted shortly.',
    mediaUrl: null,
    createdAt: serverTimestamp(),
    readBy: [user.uid],
  });
  ok('Test message written.');
  await deleteDoc(testMessage);
  ok('Test message deleted (no trace left in chat).');
} catch (error) {
  const code = error?.code ?? '';
  fail(`Message could not be written (${code || error?.message})`);
  if (code === 'permission-denied') {
    info('Rules do not allow writing messages.');
    info('Paste the latest version of firebase/firestore.rules file to console and publish.');
  }
  exitWith(1);
}

step('6) User profile test');

try {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName || (user.email ?? '').split('@')[0],
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
  ok('User profile written.');
} catch (error) {
  fail(`Profile could not be written (${error?.code || error?.message})`);
  info('users collection rules might be missing.');
  exitWith(1);
}

// --- Conclusion -------------------------------------------------------------------

console.log('\n\x1b[42m\x1b[30m  ALL SYSTEMS READY  \x1b[0m');
console.log('\nNow you can try it on the phone:');
console.log('  npm start');
console.log('\nYou can also find out the UID values of other family members with this script:');
console.log('  just run npm run verify for each of them and log in with their credentials.\n');

await signOut(auth);
await terminate(db);
exitWith(0);
