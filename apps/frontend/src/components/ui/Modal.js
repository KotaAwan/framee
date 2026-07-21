import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  className 
}) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-10 sm:pt-16 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-(--color-surface) rounded-lg shadow-lg w-full max-w-lg overflow-hidden flex flex-col border border-(--color-border)",
          className
        )}
      >
        <div className="flex justify-between items-center p-4 border-b border-(--color-border)">
          <h2 className="text-lg font-semibold text-(--color-text)">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
        
        {footer && (
          <div className="p-4 border-t border-(--color-border) bg-(--color-surface-hover)/50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
