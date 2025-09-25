import React, { useState } from 'react';
import Layout from '../components/Layout';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { User } from '../types/index';

export default function Chat() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showList, setShowList] = useState<boolean>(true);

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex flex-col sm:flex-row">
        {/* Chat List (Sidebar on desktop, full-width on mobile) */}
        <div className={`${showList ? 'block' : 'hidden sm:block'} w-full sm:w-80 border-b sm:border-b-0 sm:border-r bg-white`}>
          <div className="h-full flex flex-col">
            <div className="p-3 sm:p-4 border-b flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Chats</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList
                onSelectChat={(user) => {
                  setSelectedUser(user);
                  setShowList(false);
                }}
                selectedUserId={selectedUser?.id}
              />
            </div>
          </div>
        </div>

        {/* Chat Window */}
        <div className={`${showList && !selectedUser ? 'hidden sm:block' : 'block'} flex-1 bg-white`}>
          {selectedUser ? (
            <div className="h-full flex flex-col">
              <div className="p-3 sm:p-4 border-b">
                <div className="flex items-center">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setShowList(true)}
                    className="sm:hidden mr-2 text-gray-600 hover:text-gray-800 touch-manipulation"
                    aria-label="Back to chats"
                  >
                    ←
                  </button>
                  <img
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
                    src={selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${selectedUser.full_name}`}
                    alt={selectedUser.full_name}
                  />
                  <div className="ml-2 sm:ml-3">
                    <h2 className="text-base sm:text-lg font-medium text-gray-900">
                      {selectedUser.full_name}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 capitalize">
                      {selectedUser.role}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <ChatWindow chatPartner={selectedUser} />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 p-4 text-sm sm:text-base">
              Select a chat to start messaging
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 