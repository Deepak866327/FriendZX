import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useCallContext } from '@/context/CallContext';
import { NotificationItem } from './NotificationItem';

export const NotificationPanel: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const { incomingRequest, approveRequest, denyRequest } = useCallContext();
  const [filterType, setFilterType] = useState<string | null>(null);

  const filteredNotifications = filterType
    ? notifications.filter(n => n.type === filterType)
    : notifications;

  const notificationTypes = Array.from(
    new Set(notifications.map(n => n.type))
  );

  return (
    <div className="notification-panel">
      <div className="panel-header">
        <h2>Notifications</h2>
        {unreadCount > 0 && (
          <button
            className="btn btn-sm btn-link"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        )}
      </div>

      {incomingRequest && (
        <div className="call-request-notification">
          <div className="call-request-avatar">
            {incomingRequest.fromName.charAt(0).toUpperCase()}
          </div>
          <div className="call-request-info">
            <p className="call-request-name">{incomingRequest.fromName}</p>
            <p className="call-request-text">
              wants to {incomingRequest.callType === 'video' ? '📹 video' : '📞 audio'} call you
            </p>
          </div>
          <div className="call-request-actions">
            <button className="call-req-btn call-req-deny" onClick={denyRequest}>Deny</button>
            <button className="call-req-btn call-req-allow" onClick={approveRequest}>Allow</button>
          </div>
        </div>
      )}

      <div className="panel-filters">
        <button
          className={`filter-btn ${filterType === null ? 'active' : ''}`}
          onClick={() => setFilterType(null)}
        >
          All ({notifications.length})
        </button>
        {notificationTypes.map(type => {
          const count = notifications.filter(n => n.type === type).length;
          return (
            <button
              key={type}
              className={`filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      <div className="panel-content">
        {isLoading ? (
          <div className="loading">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <p>No notifications</p>
          </div>
        ) : (
          <div className="notification-list">
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => markAsRead(notification.id)}
                onDelete={() => deleteNotification(notification.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};