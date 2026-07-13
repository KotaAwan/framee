import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children }) {
  // Start with open sidebar on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto close sidebar on mobile if it starts as true
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
        
        <main className="flex-1 overflow-y-auto p-4 lg:px-6 lg:pb-6 lg:pt-5">
          <div className="mx-auto max-w-full">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-6 flex items-center justify-between text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <div>Copyright &copy; 2026 - NoCode</div>
          <div>v1.0.0 - EN</div>
        </footer>
      </div>
    </div>
  );
}
