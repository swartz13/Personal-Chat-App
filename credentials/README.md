# Credentials Guide

This directory is intended to store signing keys and service account files for the Family Chat application.

**IMPORTANT:** This directory is gitignored. Files placed here are never committed to version control.

## Required Files

1. **`release.keystore`**
   - Android release signing key.
   - How to generate:
     ```bash
     keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
     ```

2. **`keystore.json`**
   - Keystore credentials file.
   - Format:
     ```json
     {
       "storeFile": "release.keystore",
       "storePassword": "YOUR_KEYSTORE_PASSWORD",
       "keyAlias": "release",
       "keyPassword": "YOUR_KEY_PASSWORD"
     }
     ```

3. **`fcm-service-account.json`**
   - Firebase Admin SDK service account key.
   - How to get: Go to Firebase Console > Project Settings > Service accounts > Generate new private key.

## Security Warnings

- **Never share or commit these files.** They contain highly sensitive information.
- **Back up your keystore (`release.keystore`).** If you lose this file, you will not be able to publish updates to your app, and users will be forced to reinstall the application completely.
