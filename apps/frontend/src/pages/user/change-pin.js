import { useState } from 'react';
import Head from 'next/head';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';
import { KeyRound, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';

export default function ChangePIN() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Form State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleChangePin = async (e) => {
    e.preventDefault();
    setMessage('');
    
    if (newPin !== confirmPin) {
      setMessageType('error');
      setMessage(t('pin.mismatch', 'New PIN and confirm PIN do not match.'));
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setMessageType('error');
      setMessage(t('pin.length', 'PIN must be between 4 and 6 characters.'));
      return;
    }

    setIsSaving(true);

    try {
      // NOTE: This endpoint might not be fully implemented in the backend yet.
      const res = await axios.put('http://localhost:3001/api/v1/user/pin', {
        current_pin: currentPin,
        new_pin: newPin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setMessageType('success');
        setMessage(t('pin.success', 'PIN changed successfully!'));
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      }
    } catch (error) {
      console.error('Failed to change PIN:', error);
      setMessageType('error');
      setMessage(error.response?.data?.error || t('pin.error', 'Failed to change PIN. Please check your current PIN.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t('pin.title', 'Change PIN')} | Framee</title>
      </Head>

      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-blue-600 dark:text-blue-500">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {t('pin.title', 'Change PIN')}
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> / {t('user', 'User')} / <span className="text-slate-900 dark:text-slate-100">{t('pin.title', 'Change PIN')}</span>
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

            <form onSubmit={handleChangePin} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('pin.current', 'Current PIN')}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('pin.new', 'New PIN')}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('pin.confirm', 'Confirm New PIN')}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
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
