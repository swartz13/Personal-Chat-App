# Family Chat — Setup Guide

This document describes the steps required to set up the application from scratch.

> **Status:** Firebase setup completed, application compiled and tested. This document is useful when re-installing or working on another computer.

---

## 1. Firebase Project

1. https://console.firebase.google.com → **Add project**
2. **Build > Firestore Database > Create database** → location `eur3 (europe-west)` → production mode
3. **Build > Authentication > Get started** → **Sign-in method** → Enable **Email/Password**

## 2. Group Accounts

There is intentionally no sign-up screen; you create the accounts from the console.

1. Create accounts via **Authentication > Users > Add user**
2. Note the **User UID** value for each account (needed in step 4)
3. **Authentication > Settings > User actions** → **Disable "Enable create (sign-up)"** option

> This last item is important: if you don't disable it, someone who gets hold of the app's Firebase credentials can open an account for themselves. When disabled, only the accounts you created exist.

## 3. Security Rules

Paste the contents of the `firebase/firestore.rules` file into the **Firestore Database > Rules** tab and click **Publish**. The rules ensure the following:

- Only people in the `members` list in the `chats/family` document can see the messages
- Nobody can send a message on behalf of someone else
- Everyone can only delete their own message

## 4. Chat Document

**Firestore Database > Start collection**:

- Collection ID: `chats`
- Document ID: `family` *(do not use auto-ID, type it manually)*

| Field | Type | Value |
|---|---|---|
| `name` | string | `Family` |
| `members` | **array** | The UIDs from step 2 (each a string) |

The type of the `members` field must strictly be an **array**.

## 5. Application Settings

Firebase console > **Project settings > General > Your apps** → Add web app (No need for Hosting). Write the resulting `firebaseConfig` values to the `.env` file:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID=1:YOUR_SENDER_ID:web:...
```

See the next section for Cloudinary values.

The `.env` file is in `.gitignore`, it is not shared.

## 5b. Cloudinary (Photo and Video Storage)

Because Firebase Storage requires a paid plan (Blaze), photos and videos are stored in Cloudinary's free tier: 25 GB of space, no card required.

1. Sign up for free at https://cloudinary.com/users/register_free
2. Copy the **Cloud name** value from the **Dashboard**
3. **Settings > Upload > Upload presets > Add upload preset**
   - **Signing Mode: Unsigned** *(this is mandatory — for direct upload from the phone)*
   - Note down the preset name
4. Write both to the `.env` file:

```
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_UPLOAD_PRESET
```

> **Privacy note:** File URLs in Cloudinary are random and unpredictable, but not encrypted — anyone who captures the URL can see the file. Message contents (who, when, what was written) are protected by Firebase rules; only media files reside in Cloudinary.

> **Quota:** 25 GB storage and 25 GB monthly download. If it fills up, you can delete old files from the Cloudinary panel.

## 5c. Notifications (Expo)

To notify that a message has arrived when the application is closed, notification infrastructure is required. Normally this requires a server (Cloud Functions); instead, the phone sending the message sends a notification directly to the other members via Expo's free notification service. No server and no paid plan required.

One-time setup (done, for reference):

1. **Add Android app to Firebase** — package name `com.example.familychat`, download the `google-services.json` file and place it in the project root
2. **Download service account key** — Firebase console > Project settings > Service accounts > Generate new private key
3. **Open an Expo account** (expo.dev, free) and generate an access token
4. Connect the project to Expo:

```bash
EXPO_TOKEN=<token> npx eas-cli@latest init --non-interactive
```

5. Upload the service account key to Expo — since the `eas credentials` command only runs interactively, this was done via Expo's API; alternatively, it can be uploaded from the expo.dev > project > Credentials page.

> Key files are in the `credentials/` folder and in `.gitignore`. `google-services.json` is also kept out of git.

## 5d. Voice and Video Calling

Calls are established with WebRTC **directly phone-to-phone**; audio and video do not pass through a server. Firestore is only used to exchange connection information that allows the two phones to find each other.

No additional setup required — rules and permissions are ready. Things to know:

- Phones on the **same home network** find each other directly.
- For phones on **different networks** (one mobile data, the other wifi), traffic might have to pass through a relay server. Free public relay servers (`openrelay.metered.ca`) are currently defined; if it slows down during heavy usage, a server you obtained with your own account can be added to the `ICE_SERVERS` list in `src/services/calls.ts` (metered.ca provides a free tier).
- The screen does not turn off automatically during a call.

## 6. Verify Installation

```bash
npm run verify
```

It asks for email and password, then performs six checks in sequence: is `.env` correct, can it connect to Firebase, does login work, does the `chats/family` document exist, is the UID in the `members` list, can a message be written. At the end you should see the text **ALL SET**. It writes a test message and deletes it immediately, leaving no trace in the chat.

You can also provide the credentials from the command line:

```bash
npm run verify -- email@example.com password
```

---

## Phone Installation (APK)

### With a single command

Connect the phone via USB, turn on **Developer options > USB debugging**, then:

```bash
npm run apk
```

This command compiles the APK, installs it on the phone, and launches the application.
The first compilation takes 10–20 minutes (Gradle and dependencies are downloaded), subsequent ones take 2 minutes.

### Other members' phones

You can send the compiled file directly:

```
android/app/build/outputs/apk/release/app-release.apk
```

Send it via WhatsApp/Telegram, the other party should tap the file and install it. If Android gives an "unknown source" warning, they must grant permission for that application.

> **Important:** APKs are signed with the `credentials/family-chat.keystore` file. If you lose this file, you won't be able to install new versions as updates; everyone will have to delete the app and reinstall. Back it up and don't share it with anyone.

### Quick testing during development

```bash
npm start
```

You can test instantly by scanning the QR code with the Expo Go application. However, when video calling is added later, Expo Go will not be enough, it will be necessary to test with the APK.

---

## Required Tools

| Tool | Version | Note |
|---|---|---|
| Node.js | 20+ | installed |
| Java | 21 | installed |
| Android SDK | API 35–36, build-tools 36 | `$ANDROID_HOME` or `~/Android/Sdk` |
| adb | platform-tools | `$ANDROID_HOME/platform-tools` or `~/Android/Sdk/platform-tools` |

---

## Troubleshooting

| Symptom | Solution |
|---|---|
| "Missing settings" warning | `.env` is not filled or the application has not been restarted |
| "Messages could not be loaded" | Rules are not published or UID is not in the `members` list |
| "Incorrect email or password" | Account is not created in the console or password is wrong |
| Message not sending | `chats/family` document does not exist or `members` field is not an array |
| `npm run apk` cannot find device | USB debugging is off or permission on the phone is not approved |

In any case, run `npm run verify` first — it usually states the error directly.
