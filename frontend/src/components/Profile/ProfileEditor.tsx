import React, { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { UpdateProfileData } from '@/types/models';

export const ProfileEditor: React.FC = () => {
  const { profile, updateProfile, isLoading, error } = useUser();
  const [formData, setFormData] = useState<UpdateProfileData>({
    bio: '',
    location: '',
    interests: [],
  });
  const [interestInput, setInterestInput] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || '',
        location: profile.location || '',
        interests: profile.interests || [],
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddInterest = () => {
    if (interestInput.trim()) {
      setFormData(prev => ({
        ...prev,
        interests: [...(prev.interests || []), interestInput.trim()],
      }));
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(formData);
  };

  return (
    <div className="profile-editor">
      <h2>Edit Profile</h2>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself"
            disabled={isLoading}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Enter your location"
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label>Interests</label>
          <div className="interest-input">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              placeholder="Add an interest"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={handleAddInterest}
              disabled={isLoading}
              className="btn btn-sm"
            >
              Add
            </button>
          </div>

          {formData.interests && formData.interests.length > 0 && (
            <div className="interest-tags">
              {formData.interests.map((interest, index) => (
                <div key={index} className="tag">
                  {interest}
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(index)}
                    className="remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};