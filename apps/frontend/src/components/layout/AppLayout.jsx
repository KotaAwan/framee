import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-(--color-background)">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full min-w-0">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        
        <main className="flex-1 overflow-auto bg-(--color-background) px-4 pt-3 pb-2 md:px-6 md:pt-4 flex flex-col relative h-[calc(100vh-var(--header-height,56px))]">
          <div className="mx-auto max-w-[var(--content-max-width,1200px)] flex-1 w-full flex flex-col mb-6">
            {children}
          </div>
          
          {/* Footer */}
          <footer className="mt-auto border-t border-(--color-border) pt-2 flex justify-between items-center text-xs text-(--color-muted) shrink-0 -mx-4 md:-mx-6 px-4 md:px-6">
            <div>Framee &copy; {new Date().getFullYear()}</div>
            <div className="flex gap-1 items-center">
              <span>v1.0.0</span>
              <span>-</span>
              <span>EN</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
