import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChatList } from '@/components/Chat/ChatList';
import { ChatModal } from '@/components/Chat/ChatModal';
import { PublicProfile } from '@/types/api';
import { pageVariants } from '@/utils/animations';

export const MessagesPage: React.FC = () => {
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);

  return (
    <motion.div
      className="pb-28 pt-4 max-w-2xl mx-auto px-4 sm:px-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <ChatList onSelectConversation={profile => setChatTarget(profile)} />

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </motion.div>
  );
};
