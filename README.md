# Family Chat

A private, self-hosted family chat application with real-time messaging, voice/video calls, media sharing, and push notifications. Built with React Native (Expo) and Firebase.

## Features

- Real-time messaging with read receipts
- Voice and video calls (WebRTC peer-to-peer)
- Photo, video, and document sharing (Cloudinary)
- Push notifications (Expo Push Service)
- Rich text formatting (*bold*, _italic_, ~strikethrough~)
- Customizable app themes and chat backgrounds
- Call history
- Message unsend (if unread)
- No server required — fully serverless architecture

## Tech Stack

- **Framework**: Expo SDK 57, React Native 0.86, React 19
- **Backend**: Firebase (Auth + Firestore)
- **Communication**: WebRTC for calls
- **Media Storage**: Cloudinary
- **Language**: TypeScript

## Prerequisites

- Node.js 20+
- Java 21
- Android SDK
- Firebase project
- Cloudinary account
- Expo account

## Quick Start

Please refer to [SETUP.md](SETUP.md) for detailed installation and configuration instructions.

## Architecture

Family Chat is designed with a serverless architecture, relying on Firebase for authentication and real-time database capabilities (Firestore). Media files are uploaded directly to Cloudinary, reducing the load on your database. Voice and video calls use WebRTC for encrypted, peer-to-peer communication. Push notifications are handled via the Expo Push Service, seamlessly integrating with Firebase Cloud Messaging.

> **Note**: This application is specifically designed and optimized for small private groups, such as families.

## License

This project is licensed under the MIT License.
