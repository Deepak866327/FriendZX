import React, { useState, useEffect } from 'react';
import { X, MapPin, Tag, CheckCircle } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { UpdateProfileData } from '@/types/models';

export const ProfileEditor: React.FC = () => {
  const { profile, updateProfile, isLoading, error } = useUser();

  const [formData,      setFormData]      = useState<UpdateProfileData>({ bio: '', location: '', interests: [] });
  const [interestInput, setInterestInput] = useState('');
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({ bio: profile.bio || '', location: profile.location || '', interests: profile.interests || [] });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddInterest = () => {
    const tag = interestInput.trim();
    if (!tag) return;
    setFormData(prev => ({ ...prev, interests: [...(prev.interests || []), tag] }));
    setInterestInput('');
  };

  const handleRemoveInterest = (index: number) => {
    setFormData(prev => ({ ...prev, interests: prev.interests?.filter((_, i) => i !== index) || [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await updateProfile(formData);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <h2 className="text-base font-bold text-slate-800 mb-6">Edit Profile</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-xs font-semibold text-slate-600">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself…"
            disabled={isLoading}
            rows={4}
            className="input-glass resize-none"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-xs font-semibold text-slate-600">Location</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
            <input
              id="location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="City, Country"
              disabled={isLoading}
              className="input-glass pl-9"
            />
          </div>
        </div>

        {/* Interests */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Tag size={12} className="text-indigo-400" />
            Interests
          </label>

          {/* Tag input row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={e => setInterestInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddInterest(); } }}
              placeholder="e.g. hiking, music, travel"
              disabled={isLoading}
              className="input-glass flex-1"
            />
            <button
              type="button"
              onClick={handleAddInterest}
              disabled={isLoading || !interestInput.trim()}
              className="btn-secondary text-xs px-4 flex-shrink-0 disabled:opacity-40"
              style={{ minHeight: 44 }}
            >
              Add
            </button>
          </div>

          {/* Tags */}
          {formData.interests && formData.interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {formData.interests.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(i)}
                    className="text-indigo-400 hover:text-red-500 transition-colors ml-0.5"
                    aria-label={`Remove ${tag}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Feedback */}
        {error && (
          <div className="glass rounded-xl px-4 py-3 border border-red-200/60 bg-red-50/60">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {saved && (
          <div className="glass rounded-xl px-4 py-3 border border-emerald-200/60 bg-emerald-50/60 flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Profile saved successfully!</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full disabled:opacity-60"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Saving…
            </span>
          ) : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};
