import React, { useState } from 'react';
import { ChatList } from '@/components/Chat/ChatList';
import { ChatModal } from '@/components/Chat/ChatModal';
import { PublicProfile } from '@/types/api';

export const MessagesPage: React.FC = () => {
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);

  return (
    <>
      <div className="messages-page-wrap">
        <ChatList onSelectConversation={profile => setChatTarget(profile)} />
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
