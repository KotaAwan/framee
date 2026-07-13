import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  Settings, 
  Users, 
  FileText, 
  Box, 
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Languages,
  ArrowLeftRight,
  Shield,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

const SIDEBAR_MENU = [
  {
    category: 'DASHBOARD',
    icon: Home,
    items: [
      { name: 'Welcome', path: '/', icon: Home },
    ]
  },
  {
    category: 'SYSTEM',
    icon: Box,
    items: [
      { name: 'Doctype', path: '/system/sys_doctype', icon: FileText },
      { name: 'Language', path: '/system/language', icon: Languages },
      { name: 'Translate', path: '/system/translate', icon: ArrowLeftRight },
      { name: 'Module', path: '/system/module', icon: Box },
      { name: 'Menu', path: '/system/menu', icon: LayoutDashboard }, 
      { name: 'Role', path: '/settings/role', icon: Shield },
      { name: 'Role Menu', path: '/settings/role_menu', icon: LayoutDashboard },
      { name: 'User', path: '/settings/user', icon: Users },
      { name: 'User Role', path: '/settings/user_role', icon: Users },
    ]
  }
];

export function Sidebar({ isOpen, setIsOpen }) {
  const router = useRouter();
  
  // Awal menu tidak tampil (hanya Module saja dahulu) -> default {} (semua tertutup)
  const [expandedModules, setExpandedModules] = useState({});

  const toggleModule = (category) => {
    // Jika sidebar sedang tertutup, buka dulu
    if (!isOpen) {
      setIsOpen(true);
    }
    
    setExpandedModules(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-[#1a202c] text-slate-300 transition-all duration-300 flex flex-col dark:border-slate-800 overflow-hidden shrink-0",
          "fixed inset-y-0 left-0 z-50 md:static md:translate-x-0", // fixed on mobile, static on desktop
          isOpen ? "w-64 translate-x-0 border-r border-slate-800" : "w-0 -translate-x-full border-none"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 pl-6 pr-2 w-64">
          <span className="text-xl font-bold tracking-tight text-white">NoCode</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
            onClick={() => setIsOpen(false)}
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 w-64">
          {SIDEBAR_MENU.map((group) => {
            const isExpanded = expandedModules[group.category];
            const GroupIcon = group.icon;
            
            return (
              <div key={group.category} className="mb-2">
                <button 
                  onClick={() => toggleModule(group.category)}
                  className="w-full flex items-center py-2 font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-colors justify-between px-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className="h-4 w-4" />
                    {group.category}
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                
                {isExpanded && (
                  <div className="mt-1 relative before:absolute before:inset-y-0 before:left-5 before:w-px before:bg-slate-700 space-y-1">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = router.pathname === item.path || router.asPath === item.path;
                      
                      return (
                        <Link
                          key={item.name}
                          href={item.path}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 ml-7 text-sm font-medium transition-colors relative",
                            isActive 
                              ? "bg-slate-800 text-white" 
                              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                          )}
                        >
                          {/* Timeline connector dot */}
                          <div className={cn(
                            "absolute -left-2.5 h-1.5 w-1.5 rounded-full border border-slate-700 bg-[#1a202c]",
                            isActive && "border-white bg-white"
                          )} />
                          <ItemIcon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
