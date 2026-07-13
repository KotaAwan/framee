import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';
import { User, Loader2, UploadCloud } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { useRef } from 'react';

export default function Profile() {
  const { t } = useTranslation();
  const { token, updateProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/v1/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data.success) {
          const user = res.data.data;
          setFullName(user.full_name || '');
          setEmail(user.email || '');
          setAvatarUrl(user.avatar_url || '');
          // Sync with store just in case
          updateProfile(user.full_name, user.avatar_url);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token, updateProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const res = await axios.put('http://localhost:3001/api/v1/user/me', {
        full_name: fullName,
        avatar_url: avatarUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setMessage(t('profile.save_success', 'Profile updated successfully!'));
        updateProfile(fullName, avatarUrl);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage(t('profile.save_error', 'Failed to update profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.post('http://localhost:3001/api/v1/user/avatar', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        setAvatarUrl(res.data.data.avatarUrl);
        updateProfile(fullName, res.data.data.avatarUrl);
        setMessage(t('profile.upload_success', 'Avatar uploaded successfully!'));
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setMessage(t('profile.upload_error', 'Failed to upload avatar. Ensure it is an image and under 2MB.'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{t('profile.title', 'User Profile')} | Framee</title>
      </Head>

      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-blue-600 dark:text-blue-500">
              <User className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {t('profile.title', 'User Profile')}
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <User className="h-4 w-4" /> / {t('user', 'User')} / <span className="text-slate-900 dark:text-slate-100">{t('profile', 'Profile')}</span>
          </div>
        </div>

        {/* Main Content Area */}
        <Card>
          <div className="p-4">
            {message && (
              <div className={`p-4 mb-6 rounded-md text-sm ${message.includes('success') ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <div 
                  className="relative w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group"
                  onClick={handleAvatarClick}
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400 group-hover:opacity-50 transition-opacity" />
                  )}
                  
                  {/* Hover Overlay */}
                  {!isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <UploadCloud className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  )}
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {/* Name & Email */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('profile.full_name', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('profile.email', 'Email Address')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm shadow-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-4 mt-4 flex justify-start">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 min-w-[100px]"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
