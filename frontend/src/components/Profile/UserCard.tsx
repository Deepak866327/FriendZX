import React from 'react';
import { NearbyUser } from '@/types/api';
import { formatDistance } from '@/utils/helpers';

interface UserCardProps {
  user: NearbyUser;
  onViewProfile?: () => void;
  onFollow?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onViewProfile,
  onFollow,
}) => {
  return (
    <div className="user-card-compact">
      <div className="user-card-header">
        <div className="distance-badge">
          {formatDistance(user.distance)}
        </div>
      </div>

      <div className="user-card-content">
        <h3>{user.userId}</h3>

        {user.address && (
          <p className="location">📍 {user.address}</p>
        )}

        <p className="last-updated">
          Last updated {new Date(user.lastUpdated).toLocaleTimeString()}
        </p>
      </div>

      <div className="user-card-actions">
        {onViewProfile && (
          <button className="btn btn-sm btn-outline" onClick={onViewProfile}>
            View Profile
          </button>
        )}
        {onFollow && (
          <button className="btn btn-sm btn-primary" onClick={onFollow}>
            Follow
          </button>
        )}
      </div>
    </div>
  );
};