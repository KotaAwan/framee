import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import apiClient from '../../lib/api.client';
import Icon from '../ui/Icon';

export default function MenuTree({ sidebarOpen, setSidebarOpen }) {
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [openGroups, setOpenGroups] = useState({ System: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await apiClient.get('/api/v1/workspace');
        if (res.data?.success) {
          setModules(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load workspace:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, []);

  const toggleGroup = (moduleName) => {
    if (!sidebarOpen) {
      setSidebarOpen(true);
      setOpenGroups(prev => ({ ...prev, [moduleName]: true }));
    } else {
      setOpenGroups(prev => ({
        ...prev,
        [moduleName]: !prev[moduleName]
      }));
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-400">Loading menu...</div>;
  }

  return (
    <ul className="space-y-2 px-2">
      {/* Static Dashboard Link */}
      <li className="flex flex-col mb-4">
        <Link
          href="/dashboard"
          onClick={(e) => {
            if (router.pathname === '/dashboard' || router.pathname === '/') {
              e.preventDefault();
            }
          }}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wider uppercase transition-colors w-full rounded-md",
            router.pathname === '/dashboard' || router.pathname === '/'
              ? "text-white bg-(--color-primary) shadow-sm"
              : "text-(--color-sidebar-text) hover:text-white hover:bg-(--color-sidebar-hover)"
          )}
        >
          <Icon name="Home" size={16} className="shrink-0" />
          {sidebarOpen && <span>Dashboard</span>}
        </Link>
      </li>

      {modules.filter(group => group.shortcuts && group.shortcuts.length > 0).map((group) => {
        const isOpen = openGroups[group.name];
        const groupIconName = group.icon || (group.name === 'System' || group.name === 'Settings' ? 'Settings' : 'Box');

        return (
          <li key={group.id} className="flex flex-col">
            <button
              onClick={() => toggleGroup(group.name)}
              className={clsx(
                "flex items-center justify-between px-4 py-3 text-xs font-bold tracking-wider text-(--color-sidebar-text) uppercase transition-colors w-full",
                "hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon name={groupIconName} size={16} className="shrink-0" />
                {sidebarOpen && <span>{group.name}</span>}
              </div>
              {sidebarOpen && (
                isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
            </button>
            
            {/* Child items */}
            {sidebarOpen && isOpen && group.shortcuts && (
              <ul className="mt-1 space-y-0.5 relative">
                {/* Vertical line indicator */}
                <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-700/50"></div>
                {group.shortcuts.map(shortcut => {
                  const moduleSlug = group.slug;
                  let href = `/${moduleSlug}/${shortcut.doctype}`;

                  const isActive = router.asPath.startsWith(href);
                  
                  return (
                    <li key={shortcut.id} className="relative">
                      <Link
                        href={href}
                        onClick={(e) => {
                          if (isActive && router.asPath === href) {
                            e.preventDefault();
                          }
                        }}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all ml-8 rounded-l-full",
                          isActive 
                            ? "text-white bg-(--color-primary)/10 relative before:absolute before:-left-2 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-4 before:bg-(--color-primary) before:rounded-r" 
                            : "text-(--color-sidebar-text) hover:text-white hover:bg-(--color-sidebar-hover)"
                        )}
                      >
                        {/* Dynamic Shortcut Icon */}
                        <Icon name={shortcut.icon} size={14} fallback="Database" className={isActive ? "text-(--color-primary)" : "text-gray-500"} />
                        <span>{shortcut.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
