import { supabase } from '../lib/supabase';

export type MeetingInvite = {
  id: string;
  meetingId: string;
  fromUserId: string;
  toUserId: string;
  type: 'video' | 'audio' | 'screen';
  createdAt: string;
};

export type SignalingMessage = {
  meetingId: string;
  from: string;
  to?: string;
  kind: 'invite' | 'cancel' | 'accept' | 'reject' | 'offer' | 'answer' | 'ice';
  payload?: any;
  createdAt?: string;
};

type Unsubscribe = () => void;

/**
 * MeetingSignalingService
 * Uses Supabase Realtime broadcast to exchange ephemeral signaling messages.
 * Channel name is derived from meetingId.
 */
export class MeetingSignalingService {
  private static channels: Map<string, ReturnType<typeof supabase.channel>> = new Map();
  private static personalChannels: Map<string, ReturnType<typeof supabase.channel>> = new Map();

  static getChannel(meetingId: string) {
    const channelName = `meeting:${meetingId}`;
    if (!this.channels.has(meetingId)) {
      const ch = supabase.channel(channelName, { config: { broadcast: { self: true } } });
      this.channels.set(meetingId, ch);
      // Fire-and-forget subscribe to ensure channel is active
      try { ch.subscribe(); } catch {}
    }
    return this.channels.get(meetingId)!;
  }

  static async subscribe(
    meetingId: string,
    onMessage: (msg: SignalingMessage) => void
  ): Promise<Unsubscribe> {
    const channel = this.getChannel(meetingId);
    channel.on('broadcast', { event: 'signal' }, (payload) => {
      const msg = payload.payload as SignalingMessage;
      onMessage(msg);
    });

    await channel.subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {}
      this.channels.delete(meetingId);
    };
  }

  static async send(meetingId: string, message: SignalingMessage) {
    const channel = this.getChannel(meetingId);
    try { await channel.subscribe(); } catch {}
    await channel.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  // Personal channels for direct notifications
  static getPersonalChannel(userId: string) {
    if (!this.personalChannels.has(userId)) {
      const ch = supabase.channel(`user:${userId}`, { config: { broadcast: { self: false } } });
      this.personalChannels.set(userId, ch);
      try { ch.subscribe(); } catch {}
    }
    return this.personalChannels.get(userId)!;
  }

  static async subscribePersonal(
    userId: string,
    onMessage: (msg: SignalingMessage) => void
  ): Promise<Unsubscribe> {
    const ch = this.getPersonalChannel(userId);
    ch.on('broadcast', { event: 'signal' }, (payload) => onMessage(payload.payload as SignalingMessage));
    await ch.subscribe();
    return () => {
      try { ch.unsubscribe(); } catch {}
      this.personalChannels.delete(userId);
    };
  }

  static async sendPersonalInvite(toUserId: string, message: SignalingMessage) {
    const ch = this.getPersonalChannel(toUserId);
    try { await ch.subscribe(); } catch {}
    await ch.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  // Convenience helpers
  static async sendInvite(meetingId: string, from: string, to: string, kind: MeetingInvite['type']) {
    const msg = { meetingId, from, to, kind: 'invite', payload: { type: kind }, createdAt: new Date().toISOString() } as SignalingMessage;
    // send to meeting channel and personal channel for prompt notification
    await this.send(meetingId, msg);
    await this.sendPersonalInvite(to, msg);
    return;
  }
  static async sendAccept(meetingId: string, from: string) {
    return this.send(meetingId, { meetingId, from, kind: 'accept', createdAt: new Date().toISOString() });
  }
  static async sendReject(meetingId: string, from: string) {
    return this.send(meetingId, { meetingId, from, kind: 'reject', createdAt: new Date().toISOString() });
  }
  static async sendOffer(meetingId: string, from: string, to: string | undefined, sdp: RTCSessionDescriptionInit) {
    return this.send(meetingId, { meetingId, from, to, kind: 'offer', payload: sdp, createdAt: new Date().toISOString() });
  }
  static async sendAnswer(meetingId: string, from: string, to: string | undefined, sdp: RTCSessionDescriptionInit) {
    return this.send(meetingId, { meetingId, from, to, kind: 'answer', payload: sdp, createdAt: new Date().toISOString() });
  }
  static async sendIce(meetingId: string, from: string, to: string | undefined, candidate: RTCIceCandidateInit) {
    return this.send(meetingId, { meetingId, from, to, kind: 'ice', payload: candidate, createdAt: new Date().toISOString() });
  }
  static async sendCancel(meetingId: string, from: string, toUserIds?: string[]) {
    const msg = { meetingId, from, kind: 'cancel', createdAt: new Date().toISOString() } as SignalingMessage;
    await this.send(meetingId, msg);
    if (toUserIds && toUserIds.length > 0) {
      await Promise.all(toUserIds.map((uid) => this.sendPersonalInvite(uid, msg)));
    }
  }
}


