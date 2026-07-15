import React from 'react';
import clsx from 'clsx';
import { X, Hexagon } from 'lucide-react';
import MenuTree from '../navigation/MenuTree';

export default function Sidebar({ isOpen, setIsOpen }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 transform flex flex-col bg-(--color-sidebar) text-(--color-sidebar-text) transition-all duration-300 lg:static border-r border-(--color-border)",
          isOpen ? "translate-x-0 w-[var(--sidebar-width,260px)]" : "-translate-x-full lg:w-[var(--sidebar-collapsed-width,60px)] lg:translate-x-0"
        )}
      >
        <div className="flex h-[var(--header-height,56px)] shrink-0 items-center justify-between px-6 border-b border-gray-800/50 bg-(--color-sidebar)">
          <div className="flex items-center gap-3 font-bold text-lg text-white tracking-wide">
            {isOpen && <span>Framee</span>}
          </div>
          <button 
            className="lg:hidden text-(--color-sidebar-text) hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          <MenuTree sidebarOpen={isOpen} setSidebarOpen={setIsOpen} />
        </nav>
      </aside>
    </>
  );
}
