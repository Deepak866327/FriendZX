import React from 'react';
import { useCallContext } from '@/context/CallContext';

export const CallRequestBanner: React.FC = () => {
  const { incomingRequest, approveRequest, denyRequest } = useCallContext();

  if (!incomingRequest) return null;

  return (
    <div className="call-request-banner">
      <div className="call-request-avatar" style={{ width: 36, height: 36, fontSize: '16px' }}>
        {incomingRequest.fromName.charAt(0).toUpperCase()}
      </div>
      <div className="call-request-info">
        <p className="call-request-name" style={{ fontSize: '13px' }}>{incomingRequest.fromName}</p>
        <p className="call-request-text">
          {incomingRequest.callType === 'video' ? '📹 video' : '📞 audio'} call request
        </p>
      </div>
      <div className="call-request-actions">
        <button className="call-req-btn call-req-deny" onClick={denyRequest}>Deny</button>
        <button className="call-req-btn call-req-allow" onClick={approveRequest}>Allow</button>
      </div>
    </div>
  );
};
