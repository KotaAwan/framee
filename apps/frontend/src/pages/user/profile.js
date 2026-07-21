import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth.store';
import { useLanguageStore } from '@/store/language.store';
import axios from 'axios';
import apiClient from '@/lib/api.client';
import { User, LogOut, FileText, Download, UploadCloud, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useTranslation } from '@/hooks/useTranslation';
import { useRef } from 'react';

export default function Profile() {
  const { t } = useTranslation();
  const { accessToken, updateProfile } = useAuthStore();
  const setGlobalLanguage = useLanguageStore((state) => state.setLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [idField, setIdField] = useState('');
  const [codeField, setCodeField] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!accessToken) return;

    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/api/v1/user/me');
        
        if (res.data.success) {
          const user = res.data.data;
          setFullName(user.name || user.full_name || '');
          setEmail(user.email || '');
          setIdField(user.id || '');
          setCodeField(user.code || '');
          setPhone(user.phone || '');
          setLanguage(user.language_id || '1');
          setTimezone(user.timezone || 'Asia/Jakarta');
          setDateFormat(user.date_format || 'DD/MM/YYYY');
          setAvatarUrl(user.avatar_url || '');
          // Sync with store just in case
          updateProfile(user.name || user.full_name, user.avatar_url);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [accessToken, updateProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const res = await apiClient.put('/api/v1/user/me', {
        name: fullName,
        phone,
        language_id: language,
        timezone,
        date_format: dateFormat,
        avatar_url: avatarUrl
      });

      if (res.data.success) {
        setMessage('success:' + t('profile.save_success', 'Profile updated successfully!'));
        updateProfile(fullName, avatarUrl);
        setGlobalLanguage(language === '2' ? 'id' : 'en');
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
      const res = await apiClient.post('/api/v1/user/avatar', formData, {
        headers: { 
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

  const isSuccessMessage = message.startsWith('success:');
  const displayMessage = isSuccessMessage ? message.replace('success:', '') : message;

  return (
    <>
      <Head>
        <title>{t('profile.title', 'User Profile')} | Framee</title>
      </Head>

      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-(--color-primary)">
              <User className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
              {t('profile.title', 'User Profile')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Breadcrumb items={[{ label: t('user', 'User'), href: '#' }, { label: t('profile', 'Profile') }]} />
          </div>
        </div>

        {/* Top Action Bar */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-1 bg-(--color-primary) text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('profile.update_ing', 'Updating...') : t('profile.update', 'Update')}
          </button>
        </div>

        {message && (
          <div className={`p-4 mb-6 rounded-lg text-sm font-medium shadow-sm animate-in fade-in zoom-in duration-300 flex items-center gap-2 ${isSuccessMessage ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {!isSuccessMessage && <AlertTriangle size={18} className="text-white" />}
            <div className="whitespace-pre-line">{displayMessage}</div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-(--color-border) bg-(--color-section-header-bg) flex items-center justify-between">
            <h3 className="font-semibold text-(--color-text) text-base">{t('profile.general', 'General')}</h3>
            <span className="text-sm font-semibold text-(--color-text)">
              {t('profile.id', 'ID')} : {idField}
            </span>
          </div>
          
          <div className="px-5 pt-5 pb-8">

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Section */}
              <div className="flex justify-center mb-6">
                <div className="flex flex-col items-center gap-4">
                <div 
                  className="relative w-20 h-20 rounded-full bg-(--color-surface-hover) border border-(--color-border) overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group"
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
              </div>

              {/* Form Fields Grid */}
              <div className="flex flex-col gap-4">
                
                {/* Code (Read Only) */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.code', 'Code')}
                  </label>
                  <input
                    type="text"
                    value={codeField}
                    disabled
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface-hover) px-3 py-1 text-sm shadow-sm text-(--color-muted) cursor-not-allowed"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.full_name', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text)"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.email', 'Email Address')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface-hover) px-3 py-1 text-sm shadow-sm text-(--color-muted) cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.phone', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text)"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.language', 'Language')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text)"
                  >
                    <option value="1">English (US)</option>
                    <option value="2">Bahasa Indonesia</option>
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.timezone', 'Timezone')}
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text)"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta</option>
                    <option value="Asia/Singapore">Asia/Singapore</option>
                    <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </select>
                </div>

                {/* Date Format */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    {t('profile.date_format', 'Date Format')}
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text)"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  </select>
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  );
}
