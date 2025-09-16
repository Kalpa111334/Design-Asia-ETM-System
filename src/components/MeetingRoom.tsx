import React, { useEffect, useRef, useState } from 'react';
import { MeetingSignalingService, SignalingMessage } from '../services/MeetingSignalingService';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  meetingId: string;
  mode: 'video' | 'audio' | 'screen';
  onLeave?: () => void;
};

export default function MeetingRoom({ meetingId, mode, onLeave }: Props) {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let localStream: MediaStream | null = null;

    const start = async () => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      pc.ontrack = (ev) => {
        if (remoteVideoRef.current) {
          const [stream] = ev.streams;
          remoteVideoRef.current.srcObject = stream;
        }
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && user) {
          MeetingSignalingService.sendIce(meetingId, user.id, undefined, ev.candidate.toJSON());
        }
      };

      const constraints: MediaStreamConstraints =
        mode === 'audio'
          ? { audio: true, video: false }
          : { audio: true, video: mode === 'screen' ? false : { width: { ideal: 1280 }, height: { ideal: 720 } } };

      localStream = mode === 'screen'
        ? await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true }).catch(async () => {
            return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          })
        : await navigator.mediaDevices.getUserMedia(constraints);

      if (localStream) {
        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));
      }
      if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;

      unsubscribe = await MeetingSignalingService.subscribe(meetingId, async (msg: SignalingMessage) => {
        if (!user) return;
        if (msg.from === user.id) return; // ignore self

        if (msg.kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await MeetingSignalingService.sendAnswer(meetingId, user.id, msg.from, answer);
        } else if (msg.kind === 'answer') {
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          }
        } else if (msg.kind === 'ice') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
          } catch {}
        }
      });

      // Act as the caller by default
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (user) await MeetingSignalingService.sendOffer(meetingId, user.id, undefined, offer);
      setJoined(true);
    };

    start();

    return () => {
      try { unsubscribe && unsubscribe(); } catch {}
      try { pcRef.current?.close(); } catch {}
      try { localStream?.getTracks().forEach((t) => t.stop()); } catch {}
      pcRef.current = null;
    };
  }, [meetingId, mode, user]);

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-md bg-black aspect-video" />
        </div>
        <div className="flex-1">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-md bg-black aspect-video" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
          onClick={() => {
            const stream = (localVideoRef.current?.srcObject as MediaStream) || null;
            if (!stream) return;
            stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
            setMuted((m) => !m);
          }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
          onClick={() => {
            const stream = (localVideoRef.current?.srcObject as MediaStream) || null;
            if (!stream) return;
            stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
            setCameraOff((v) => !v);
          }}
        >
          {cameraOff ? 'Start Camera' : 'Stop Camera'}
        </button>
        <button
          className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm"
          onClick={() => onLeave && onLeave()}
        >
          Leave
        </button>
      </div>
    </div>
  );
}


