import React from 'react';
import { UserProfile } from '@/types/api';
import { truncateText, getInitials } from '@/utils/helpers';

interface ProfileCardProps {
  profile: UserProfile;
  onFollow?: () => void;
  onUnfollow?: () => void;
  isFollowing?: boolean;
  showFollowButton?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onFollow,
  onUnfollow,
  isFollowing = false,
  showFollowButton = false,
}) => {
  return (
    <div className="profile-card">
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.photos && profile.photos.length > 0 ? (
            <img src={profile.photos[0]} alt="Profile" />
          ) : (
            <div className="avatar-placeholder">
              {getInitials(profile.userId, '')}
            </div>
          )}
        </div>

        {showFollowButton && (
          <button
            className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
            onClick={isFollowing ? onUnfollow : onFollow}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      <div className="profile-content">
        <h2>{profile.userId}</h2>

        {profile.location && (
          <p className="location">📍 {profile.location}</p>
        )}

        {profile.bio && (
          <p className="bio">{truncateText(profile.bio, 150)}</p>
        )}

        <div className="stats">
          <div className="stat">
            <strong>{profile.followers}</strong>
            <span>Followers</span>
          </div>
          <div className="stat">
            <strong>{profile.following}</strong>
            <span>Following</span>
          </div>
        </div>

        {profile.interests && profile.interests.length > 0 && (
          <div className="interests">
            <h4>Interests</h4>
            <div className="interests-tags">
              {profile.interests.slice(0, 5).map((interest, index) => (
                <span key={index} className="tag">{interest}</span>
              ))}
              {profile.interests.length > 5 && (
                <span className="tag">+{profile.interests.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {profile.photos && profile.photos.length > 1 && (
          <div className="photos">
            <h4>Photos</h4>
            <div className="photo-grid">
              {profile.photos.slice(0, 4).map((photo, index) => (
                <img key={index} src={photo} alt={`Photo ${index + 1}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};