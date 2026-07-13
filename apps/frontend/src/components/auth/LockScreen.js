import { useState } from 'react';
import { useRouter } from 'next/router';
import { LockKeyhole } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';

export function LockScreen() {
  const router = useRouter();
  const { email, unlockSession, incrementPinFailedAttempt, pinFailedAttempts, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const MAX_ATTEMPTS = 3;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    
    if (pin.length < 4) {
      setError('PIN is too short');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/api/v1/auth/verify-pin', {
        email,
        pin
      });

      if (response.data.success) {
        unlockSession();
      }
    } catch (err) {
      const newAttempts = pinFailedAttempts + 1;
      incrementPinFailedAttempt();
      
      if (newAttempts >= MAX_ATTEMPTS) {
        logout();
        router.push('/login');
      } else {
        setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <LockKeyhole className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Session Locked</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Your session was locked due to inactivity. Enter your PIN to continue.
        </p>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center tracking-widest text-2xl px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="••••••"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || pin.length < 4}
            className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button 
            onClick={handleLogout}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Forgot PIN? Log out instead
          </button>
        </div>
      </div>
    </div>
  );
}
