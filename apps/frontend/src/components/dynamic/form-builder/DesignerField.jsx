import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function DesignerField({ fieldname, field, register, readOnly, handleDelete, handleEdit }) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-(--color-surface) border border-(--color-border) p-2.5 rounded-md flex items-center hover:border-blue-400/50 transition-colors shadow-2xs group/field">
      <span className="cursor-move mr-2 text-(--color-muted) hover:text-(--color-text) flex-shrink-0">
        <GripVertical size={16} />
      </span>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-center">
          {!readOnly && field._originalIndex >= 0 ? (
            <input 
              type="text" 
              className="bg-transparent border-0 border-b border-dashed border-(--color-border) focus:ring-0 focus:border-blue-500 p-0 text-xs font-semibold text-(--color-text) w-full truncate" 
              placeholder={t('Field Label')}
              {...register(`${fieldname}.${field._originalIndex}.label`)}
            />
          ) : (
            <span className="text-xs font-semibold text-(--color-text) w-full truncate">{field.label}</span>
          )}
        </div>
        
        <div 
          onClick={() => !readOnly && handleEdit && handleEdit(field._originalIndex)}
          className="mt-2 bg-(--color-surface) border border-(--color-border) rounded px-2.5 py-1.5 text-xs text-(--color-muted) cursor-pointer hover:border-blue-400/60 hover:text-blue-500 transition-colors"
          title={t('Click to open Field Settings')}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-(--color-text)">{field.fieldname || 'field_name'}</span>
            <span 
              className="border rounded px-2 py-0.5 text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-400"
              style={{ borderColor: 'rgba(209, 213, 219, 0.4)' }}
            >
              {field.fieldtype}
            </span>
          </div>
        </div>
      </div>
      
      {!readOnly && field._originalIndex >= 0 && (
        <button 
          type="button"
          onClick={() => handleDelete(field._originalIndex, field.label || field.fieldname || t('Field'))}
          className="text-(--color-muted) hover:text-red-500 ml-2 opacity-0 group-hover/field:opacity-100 transition-opacity flex-shrink-0"
          title={t('Delete Field')}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
