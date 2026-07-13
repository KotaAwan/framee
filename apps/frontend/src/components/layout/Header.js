import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Sun, Moon, LogOut, User, LockKeyhole, KeyRound } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '../../lib/utils';

export function Header({ onMenuClick }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const router = useRouter();
  const { email, fullName, avatarUrl, logout } = useAuthStore();

  const userInitials = fullName 
    ? fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : email ? email.substring(0, 2).toUpperCase() : 'U';

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-6 dark:border-slate-800 dark:bg-slate-950">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-10 w-10 -ml-2 rounded-full text-slate-500"
        onClick={onMenuClick}
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      <div className="flex flex-1 items-center justify-end gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle Theme</span>
          </Button>
        )}

        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full relative text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
        </Button>
        
        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-semibold hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 transition-all dark:hover:ring-offset-slate-950 outline-none overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              userInitials
            )}
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-900 dark:ring-slate-800 border border-slate-200 dark:border-slate-800">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{fullName || 'User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email || 'user@example.com'}</p>
              </div>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => {
                  setIsProfileOpen(false);
                  router.push('/user/profile');
                }}
              >
                <User className="h-4 w-4" /> Profile
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => {
                  setIsProfileOpen(false);
                  router.push('/user/change-password');
                }}
              >
                <LockKeyhole className="h-4 w-4" /> Change Password
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => {
                  setIsProfileOpen(false);
                  router.push('/user/change-pin');
                }}
              >
                <KeyRound className="h-4 w-4" /> Change PIN
              </button>
              <div className="border-t border-slate-200 dark:border-slate-800 my-1"></div>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => {
                  setIsProfileOpen(false);
                  logout();
                  router.push('/login');
                }}
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
