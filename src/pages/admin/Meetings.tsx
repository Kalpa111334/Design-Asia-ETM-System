import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MeetingSignalingService } from '../../services/MeetingSignalingService';
import { User } from '../../types/index';
import MeetingRoom from '../../components/MeetingRoom';

type MeetingType = 'video' | 'audio' | 'screen';

export default function Meetings() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [meetingType, setMeetingType] = useState<MeetingType>('video');
  const [topic, setTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [justNow, setJustNow] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, { full_name: string; email: string }>>({});
  const publicBaseUrl = (import.meta as any).env?.VITE_PUBLIC_BASE_URL || window.location.origin;

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'admin');
      if (!error) setEmployees(data || []);
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createAndInvite = async () => {
    if (!user) return;
    setCreating(true);
    const id = crypto.randomUUID();
    setMeetingId(id);
    // Broadcast invites fast
    await Promise.all(
      selected.map((empId) => MeetingSignalingService.sendInvite(id, user.id, empId, meetingType))
    );
    setCreating(false);
  };

  // Track participants who accept
  useEffect(() => {
    if (!meetingId || !user) return;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      unsubscribe = await MeetingSignalingService.subscribe(meetingId, (msg) => {
        if (msg.kind === 'accept') {
          setParticipantIds((prev) => (prev.includes(msg.from) ? prev : [...prev, msg.from]));
        }
      });
    })();
    return () => {
      try { unsubscribe && unsubscribe(); } catch {}
      setParticipantIds([]);
      setParticipantMap({});
    };
  }, [meetingId, user]);

  // Resolve participant details for display
  useEffect(() => {
    if (participantIds.length === 0) return;
    const unresolved = participantIds.filter((id) => !participantMap[id]);
    if (unresolved.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', unresolved);
      if (data && data.length > 0) {
        setParticipantMap((prev) => {
          const next = { ...prev } as Record<string, { full_name: string; email: string }>;
          for (const u of data) {
            next[u.id] = { full_name: u.full_name, email: u.email };
          }
          return next;
        });
      }
    })();
  }, [participantIds, participantMap]);

  return (
    <Layout>
      <div className="px-2 sm:px-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Topic</label>
              <input
                className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Standup / Review / 1:1"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="mt-1 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="screen">Screen Share</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Just now</label>
              <input type="checkbox" checked={justNow} onChange={() => setJustNow((v) => !v)} />
            </div>
            {!justNow && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Schedule</label>
                <input
                  type="datetime-local"
                  className="mt-1 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}
            <button
              onClick={createAndInvite}
              disabled={creating || selected.length === 0}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Sending…' : 'Create & Invite'}
            </button>
          </div>

          <div className="bg-white rounded-md border shadow-sm">
            <div className="p-3 border-b font-medium">Employees</div>
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-gray-50">
                  <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{emp.full_name}</div>
                    <div className="text-xs text-gray-500 truncate">{emp.email}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {meetingId && (
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="text-xs text-gray-600 break-all">Meeting created: {meetingId}</div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {!showRoom ? (
                  <button
                    onClick={() => setShowRoom(true)}
                    className="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-green-700 w-full sm:w-auto"
                  >
                    Start/Join
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRoom(false)}
                    className="inline-flex items-center justify-center rounded-md bg-gray-200 px-3 py-1.5 text-gray-800 text-xs font-medium shadow-sm hover:bg-gray-300 w-full sm:w-auto"
                  >
                    Hide Room
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(meetingId);
                    } catch {}
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-indigo-700 w-full sm:w-auto"
                >
                  Copy ID
                </button>
                <button
                  onClick={() => {
                    if (!meetingId) return;
                    const base = String(publicBaseUrl).replace(/\/$/, '');
                    // Send everyone through login; dashboard will auto-join from query
                    const joinUrl = `${base}/login?meetingId=${encodeURIComponent(meetingId)}&type=${encodeURIComponent(meetingType)}`;
                    const title = topic ? `Topic: ${topic}\n` : '';
                    const msg = `${title}Meeting Invite (${meetingType}):\n${joinUrl}`;
                    const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    window.open(wa, '_blank');
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-[#25D366] px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:opacity-90 w-full sm:w-auto"
                >
                  Share via WhatsApp
                </button>
                <button
                  onClick={async () => {
                    if (!user || !meetingId) return;
                    await Promise.all(
                      selected.map((empId) => MeetingSignalingService.sendInvite(meetingId, user.id, empId, meetingType))
                    );
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-yellow-500 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-yellow-600 w-full sm:w-auto"
                >
                  Resend Invites
                </button>
                <button
                  onClick={async () => {
                    if (!user || !meetingId) return;
                    await MeetingSignalingService.sendCancel(meetingId, user.id, participantIds);
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-red-700 w-full sm:w-auto"
                >
                  End Meeting
                </button>
              </div>
            </div>
          )}

          {participantIds.length > 0 && (
            <div className="mt-3 p-3 rounded-md border bg-gray-50">
              <div className="text-xs text-gray-700 font-medium mb-2">Participants joined: {participantIds.length}</div>
              <div className="flex flex-wrap gap-2">
                {participantIds.map((pid) => {
                  const p = participantMap[pid];
                  return (
                    <div key={pid} className="px-2 py-1 rounded-full bg-white border text-xs text-gray-700">
                      {p ? p.full_name : pid.slice(0, 8)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {meetingId && showRoom && (
            <div className="mt-3">
              <MeetingRoom
                meetingId={meetingId}
                mode={meetingType}
                onLeave={() => setShowRoom(false)}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


