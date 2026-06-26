import React from 'react';
import { Notification } from '@/types/api';
import { formatRelativeTime } from '@/utils/helpers';

interface NotificationItemProps {
  notification: Notification;
  onRead?: () => void;
  onDelete?: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onDelete,
}) => {
  const getNotificationIcon = (type: string): string => {
    const icons: Record<string, string> = {
      user_registered: '👤',
      user_followed: '💙',
      user_unfollowed: '💔',
      profile_updated: '✏️',
      nearby_user_found: '📍',
      location_updated: '🗺️',
      message_received: '💬',
      match_found: '✨',
      system_alert: '⚠️',
    };
    return icons[type] || '🔔';
  };

  return (
    <div
      className={`notification-item ${notification.read ? 'read' : 'unread'}`}
      onClick={onRead}
    >
      <div className="notification-icon">
        {getNotificationIcon(notification.type)}
      </div>

      <div className="notification-body">
        <h4>{notification.title}</h4>
        <p>{notification.message}</p>
        <small className="notification-time">
          {formatRelativeTime(notification.createdAt)}
        </small>
      </div>

      {!notification.read && <div className="unread-dot"></div>}

      {onDelete && (
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};