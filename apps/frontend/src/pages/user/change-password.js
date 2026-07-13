import { useState } from 'react';
import Head from 'next/head';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';
import { LockKeyhole, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';

export default function ChangePassword() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    
    if (newPassword !== confirmPassword) {
      setMessageType('error');
      setMessage(t('password.mismatch', 'New password and confirm password do not match.'));
      return;
    }

    setIsSaving(true);

    try {
      // NOTE: This endpoint might not be fully implemented in the backend yet.
      const res = await axios.put('http://localhost:3001/api/v1/user/password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setMessageType('success');
        setMessage(t('password.success', 'Password changed successfully!'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      setMessageType('error');
      setMessage(error.response?.data?.error || t('password.error', 'Failed to change password. Please check your current password.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t('password.title', 'Change Password')} | Framee</title>
      </Head>

      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-blue-600 dark:text-blue-500">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {t('password.title', 'Change Password')}
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <LockKeyhole className="h-4 w-4" /> / {t('user', 'User')} / <span className="text-slate-900 dark:text-slate-100">{t('password.title', 'Change Password')}</span>
          </div>
        </div>

        {/* Main Content Area */}
        <Card>
          <div className="p-4">
            {message && (
              <div className={`p-4 mb-6 rounded-md text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('password.current', 'Current Password')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('password.new', 'New Password')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('password.confirm', 'Confirm New Password')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
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
