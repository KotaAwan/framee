import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth.store';
import apiClient from '@/lib/api.client';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useTranslation } from '@/hooks/useTranslation';

export default function ChangePin() {
  const { t } = useTranslation();
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [idField, setIdField] = useState('');
  const [email, setEmail] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/api/v1/user/me');
        if (res.data.success) {
          const user = res.data.data;
          setEmail(user.email || '');
          setIdField(user.id || '');
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [accessToken]);

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPin) {
      setMessage('Please fill in both current password and new PIN.');
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      const res = await apiClient.put('/api/v1/user/change-pin', {
        current_password: currentPassword,
        new_pin: newPin
      });

      if (res.data.success) {
        setMessage('success:PIN updated successfully!');
        setCurrentPassword('');
        setNewPin('');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to update PIN.';
      setMessage(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-(--color-primary)" />
      </div>
    );
  }

  const isSuccessMessage = message.startsWith('success:');
  const displayMessage = isSuccessMessage ? message.replace('success:', '') : message;

  return (
    <>
      <Head>
        <title>{t('change_pin', 'Change PIN')} | Framee</title>
      </Head>

      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-(--color-primary)">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
              {t('change_pin', 'Change PIN')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Breadcrumb items={[{ label: t('user', 'User'), href: '#' }, { label: t('change_pin', 'Change PIN') }]} />
          </div>
        </div>

        {/* Top Action Bar */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleUpdatePin}
            disabled={isSaving}
            className="flex items-center gap-1 bg-(--color-primary) text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Updating...' : t('update', 'Update')}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-(--color-border) bg-(--color-section-header-bg) flex items-center justify-between">
            <h3 className="font-semibold text-(--color-text) text-base">General</h3>
            <span className="text-sm font-semibold text-(--color-text)">
              ID : {idField}
            </span>
          </div>
          
          <div className="px-5 pt-5 pb-8">
            {message && (
              <div className={`p-4 mb-6 rounded-md text-sm font-medium ${isSuccessMessage ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {displayMessage}
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-4">
              <div className="flex flex-col gap-4">
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

                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text) pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New PIN */}
                <div>
                  <label className="block text-sm font-medium text-(--color-text) mb-1">
                    New PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPin ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      required
                      className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-primary) text-(--color-text) pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
