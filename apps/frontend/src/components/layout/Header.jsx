import React, { useState, useEffect } from 'react';
import { Menu, Bell, LogOut, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import Image from 'next/image';

export default function Header({ sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuthStore();
  const [theme, setTheme] = useState('light');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    setTheme(newTheme);
  };

  return (
    <header className="flex h-[var(--header-height,56px)] shrink-0 items-center justify-between border-b border-gray-100 bg-(--color-surface) px-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-md p-2 text-(--color-muted) hover:bg-(--color-surface-hover) hover:text-(--color-text)"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-2 relative">
        {/* Theme Selector Toggle */}
        <button 
          onClick={toggleTheme}
          className="rounded-full p-2 text-(--color-muted) hover:bg-(--color-surface-hover) hover:text-(--color-text) transition-colors"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button className="rounded-full p-2 text-(--color-muted) hover:bg-(--color-surface-hover) hover:text-(--color-text) transition-colors relative mr-2">
          <Bell size={18} />
          {/* Optional: unread indicator */}
        </button>

        <div className="flex items-center gap-3 border-l border-(--color-border) pl-4 relative">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-semibold text-(--color-text)">{user?.name || user?.fullName || 'System Administrator'}</span>
            <span className="text-[11px] text-(--color-muted) mt-0.5">{user?.roles?.[0] || 'User'}</span>
          </div>
          
          <button 
            className="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="h-8 w-8 rounded-full bg-(--color-primary) flex items-center justify-center text-white overflow-hidden relative text-xs font-bold">
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} alt="Avatar" fill className="object-cover" />
              ) : (
                <span className="uppercase">
                  {(user?.name || user?.fullName) ? (user.name || user.fullName).split(' ').map(n => n[0]).slice(0,2).join('') : 'AD'}
                </span>
              )}
            </div>
            <ChevronDown size={14} className="text-(--color-muted) ml-1" />
          </button>

          {userMenuOpen && (
            <div className="absolute top-10 right-0 mt-2 w-48 rounded-md border border-(--color-border) bg-(--color-surface) shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex flex-col">
                <span className="text-sm font-medium text-(--color-text)">{user?.name || user?.fullName || 'User'}</span>
                <span className="text-xs text-(--color-muted) truncate">{user?.roles?.[0] || 'User'}</span>
              </div>
              <div className="py-1">
                <button className="flex w-full items-center px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-hover)">
                  My Profile
                </button>
                <button className="flex w-full items-center px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-hover)">
                  Settings
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button 
                  onClick={logout}
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
