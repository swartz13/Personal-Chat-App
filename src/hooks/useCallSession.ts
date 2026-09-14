import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import {
  ICE_SERVERS,
  addIceCandidate,
  cleanupCall,
  endCall,
  setAnswer,
  setOffer,
  subscribeToCall,
  subscribeToIceCandidates,
} from '../services/calls';
import type { Call, CallType } from '../types';

export type CallPhase = 'preparing' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface Options {
  callId: string;
  /** Are we the party initiating the call? */
  isCaller: boolean;
  type: CallType;
}

/** Requests Android runtime permissions for camera and microphone. */
async function requestMediaPermissions(type: CallType) {
  if (Platform.OS !== 'android') return true;

  const toRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (type === 'video') toRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);

  const result = await PermissionsAndroid.requestMultiple(toRequest);
  return toRequest.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * Manages the full lifecycle of a call: permissions, camera/microphone,
 * WebRTC connection, and data exchange via Firestore.
 */
export function useCallSession({ callId, isCaller, type }: Options) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<CallPhase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(type === 'video');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  /** Network addresses accumulated before the remote party's answer arrives. */
  const pendingCandidates = useRef<any[]>([]);
  const remoteDescReceived = useRef(false);
  const isEnded = useRef(false);

  /** Closes the connection and the camera. Can be called multiple times. */
  const teardown = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const hangUp = useCallback(async () => {
    if (isEnded.current) return;
    isEnded.current = true;
    setPhase('ended');
    teardown();
    await endCall(callId, 'ended');
    await cleanupCall(callId);
  }, [callId, teardown]);

  useEffect(() => {
    let canceled = false;
    const unsubscribers: Array<() => void> = [];

    async function start() {
      const hasPermission = await requestMediaPermissions(type);
      if (!hasPermission) {
        setError(
          type === 'video'
            ? 'Camera and microphone permissions are required for video calls.'
            : 'Microphone permission is required for calls.'
        );
        setPhase('ended');
        await endCall(callId, 'ended');
        return;
      }

      // 1) Get our own camera/microphone stream.
      let local: MediaStream;
      try {
        local = (await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          // The default request was choosing very low resolution; HD is requested.
          video:
            type === 'video'
              ? {
                  facingMode: 'user',
                  width: { min: 640, ideal: 1280, max: 1920 },
                  height: { min: 360, ideal: 720, max: 1080 },
                  frameRate: { min: 20, ideal: 30, max: 30 },
                }
              : false,
        } as any)) as MediaStream;
      } catch (err) {
        console.warn('[call] camera/microphone could not be opened', err);
        setError('Camera or microphone could not be opened.');
        setPhase('ended');
        await endCall(callId, 'ended');
        return;
      }
      if (canceled) {
        local.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = local;
      setLocalStream(local);

      // 2) Establish the connection and add our own audio/video.
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        // Speeds up connection establishment.
        iceCandidatePoolSize: 4,
      } as any);
      pcRef.current = pc;
      local.getTracks().forEach((track) => pc.addTrack(track, local));

      // The default bandwidth limit compresses the video too much;
      // we allow up to 2.5 Mbit in video calls.
      if (type === 'video') {
        const sender = pc
          .getSenders()
          .find((s: any) => s.track?.kind === 'video') as any;
        if (sender?.getParameters) {
          try {
            const params = sender.getParameters();
            params.encodings = [
              { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
            ];
            await sender.setParameters(params);
          } catch (err) {
            console.warn('[call] video quality could not be set', err);
          }
        }
      }

      // Audio/video from the other party.
      (pc as any).addEventListener('track', (event: any) => {
        const stream = event.streams?.[0];
        if (stream) setRemoteStream(stream);
      });

      // Notify our own network addresses to the other party.
      (pc as any).addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          addIceCandidate(callId, isCaller ? 'caller' : 'callee', event.candidate.toJSON());
        }
      });

      (pc as any).addEventListener('connectionstatechange', () => {
        const status = (pc as any).connectionState;
        if (status === 'connected') setPhase('connected');
        if (status === 'failed') {
          setError('Connection could not be established.');
          setPhase('ended');
        }
      });

      /** Adds the other party's addresses when it's their turn. */
      const addCandidate = async (candidate: any) => {
        if (!remoteDescReceived.current) {
          pendingCandidates.current.push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[call] address could not be added', err);
        }
      };

      const flushPendingCandidates = async () => {
        for (const candidate of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
        pendingCandidates.current = [];
      };

      if (isCaller) {
        // 3a) Caller: create the offer and wait for the remote party's answer.
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await setOffer(callId, { type: offer.type, sdp: offer.sdp });
        setPhase('ringing');

        unsubscribers.push(
          subscribeToCall(callId, async (call) => {
            if (!call || canceled) return;
            await handleCallStatus(call);

            if (call.answer && !remoteDescReceived.current) {
              remoteDescReceived.current = true;
              setPhase('connecting');
              await pc.setRemoteDescription(new RTCSessionDescription(call.answer as any));
              await flushPendingCandidates();
            }
          })
        );
        unsubscribers.push(subscribeToIceCandidates(callId, 'callee', addCandidate));
      } else {
        // 3b) Callee: receive the incoming offer, send the answer.
        setPhase('connecting');
        unsubscribers.push(
          subscribeToCall(callId, async (call) => {
            if (!call || canceled) return;
            await handleCallStatus(call);

            if (call.offer && !remoteDescReceived.current) {
              remoteDescReceived.current = true;
              await pc.setRemoteDescription(new RTCSessionDescription(call.offer as any));
              await flushPendingCandidates();

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await setAnswer(callId, { type: answer.type, sdp: answer.sdp });
            }
          })
        );
        unsubscribers.push(subscribeToIceCandidates(callId, 'caller', addCandidate));
      }
    }

    /** End the call if the remote party closed it. */
    async function handleCallStatus(call: Call) {
      if (['ended', 'rejected', 'missed'].includes(call.status) && !isEnded.current) {
        isEnded.current = true;
        setPhase('ended');
        teardown();
      }
    }

    start().catch((err) => {
      console.warn('[call] could not be started', err);
      setError('Call could not be started.');
      setPhase('ended');
    });

    return () => {
      canceled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      teardown();
    };
  }, [callId, isCaller, type, teardown]);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const newState = !micEnabled;
    tracks.forEach((track) => (track.enabled = newState));
    setMicEnabled(newState);
  }, [micEnabled]);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    const newState = !cameraEnabled;
    tracks.forEach((track) => (track.enabled = newState));
    setCameraEnabled(newState);
  }, [cameraEnabled]);

  /** Switches between front and back camera. */
  const switchCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()?.[0] as any;
    track?._switchCamera?.();
  }, []);

  return {
    localStream,
    remoteStream,
    phase,
    error,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    switchCamera,
    hangUp,
  };
}
