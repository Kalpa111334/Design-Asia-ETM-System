import React, { useEffect, useRef, useState } from 'react';
import { MeetingSignalingService, SignalingMessage } from '../services/MeetingSignalingService';
import { useAuth } from '../contexts/AuthContext';
import { 
  MicrophoneIcon, 
  VideoCameraIcon, 
  DesktopComputerIcon,
  UserGroupIcon,
  ChatIcon,
  PhoneIcon,
  DotsVerticalIcon
} from '@heroicons/react/outline';

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
  const [screenSharing, setScreenSharing] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [participants, setParticipants] = useState<Array<{id: string, name: string, isVideoOn: boolean, isAudioOn: boolean}>>([]);

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

  const toggleMute = () => {
    const stream = (localVideoRef.current?.srcObject as MediaStream) || null;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  };

  const toggleCamera = () => {
    const stream = (localVideoRef.current?.srcObject as MediaStream) || null;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCameraOff((v) => !v);
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (pcRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
          setScreenSharing(true);
        }
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    } else {
      // Stop screen sharing and return to camera
      const stream = (localVideoRef.current?.srcObject as MediaStream) || null;
      if (stream && pcRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
        setScreenSharing(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-900">Meeting in progress</span>
          </div>
          <div className="text-xs text-gray-500">
            Meeting ID: {meetingId.slice(0, 8)}...
          </div>
        </div>
        <button
          onClick={() => onLeave && onLeave()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
        >
          <PhoneIcon className="h-4 w-4" />
          <span>End Meeting</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex relative">
        {/* Video Area */}
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className="flex-1 relative">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover bg-black" 
            />
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="text-center text-white">
                  <UserGroupIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Waiting for participants...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Local Video Preview */}
          <div className="lg:w-80 w-full lg:h-auto h-32 relative">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover bg-black rounded-lg" 
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              {user?.full_name || 'You'}
            </div>
          </div>
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-80 bg-white border-l border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Participants ({participantsCount})</h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{user?.full_name || 'You'}</div>
                  <div className="flex items-center space-x-1">
                    <MicrophoneIcon className={`h-3 w-3 ${!muted ? 'text-green-500' : 'text-red-500'}`} />
                    <VideoCameraIcon className={`h-3 w-3 ${!cameraOff ? 'text-green-500' : 'text-red-500'}`} />
                  </div>
                </div>
              </div>
              {/* Add more participants here as they join */}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="text-center text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          {/* Mic Toggle */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              muted 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <MicrophoneIcon className="h-6 w-6" />
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full transition-colors ${
              cameraOff 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={cameraOff ? 'Start Video' : 'Stop Video'}
          >
            <VideoCameraIcon className="h-6 w-6" />
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-colors ${
              screenSharing 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <DesktopComputerIcon className="h-6 w-6" />
          </button>

          {/* Participants */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`p-3 rounded-full transition-colors ${
              showParticipants 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Participants"
          >
                <UserGroupIcon className="h-6 w-6" />
            {participantsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {participantsCount}
              </span>
            )}
          </button>

          {/* Chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-3 rounded-full transition-colors ${
              showChat 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Chat"
          >
            <ChatIcon className="h-6 w-6" />
          </button>

          {/* More Options */}
          <button
            className="p-3 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            title="More Options"
          >
            <DotsVerticalIcon className="h-6 w-6" />
          </button>

          {/* Leave Meeting */}
          <button
            onClick={() => onLeave && onLeave()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-medium transition-colors flex items-center space-x-2"
          >
            <PhoneIcon className="h-5 w-5" />
            <span>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
}


