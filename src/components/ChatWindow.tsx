import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types/index';
import { useAuth } from '../contexts/AuthContext';
import { PaperAirplaneIcon } from '@heroicons/react/solid';
import toast from 'react-hot-toast';

interface Message {
  id: number;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at?: string;
}

interface ChatWindowProps {
  chatPartner: User;
}

export default function ChatWindow({ chatPartner }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const subscription = subscribeToMessages();
    return () => {
      subscription.unsubscribe();
    };
  }, [chatPartner.id]);

  useEffect(() => {
    scrollToBottom();
    markMessagesAsRead();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${chatPartner.id}),and(sender_id.eq.${chatPartner.id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    return supabase
      .channel('direct_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${chatPartner.id},recipient_id=eq.${user?.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase.from('direct_messages').insert([
        {
          content: newMessage.trim(),
          sender_id: user.id,
          recipient_id: chatPartner.id,
        },
      ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      const unreadMessages = messages.filter(
        (msg) => msg.sender_id === chatPartner.id && !msg.read_at
      );

      if (unreadMessages.length > 0) {
        const { error } = await supabase
          .from('direct_messages')
          .update({ read_at: new Date().toISOString() })
          .in(
            'id',
            unreadMessages.map((msg) => msg.id)
          );

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 sm:px-4 ${
                    isCurrentUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm sm:text-base break-words">{message.content}</p>
                  <p className="text-[10px] sm:text-xs mt-1 opacity-75 text-right">
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t">
        <div className="flex gap-2 sm:gap-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 sm:py-2.5 px-3 text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transform active:scale-95"
            title="Send message"
          >
            <PaperAirplaneIcon className="h-5 w-5 sm:h-5 sm:w-5 rotate-90" />
          </button>
        </div>
      </form>
    </div>
  );
} 