import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function DesignerField({ fieldname, field, register, readOnly, handleDelete }) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-gray-100 border border-gray-300 p-2 rounded flex items-center hover:border-blue-500 group/field">
      <span className="cursor-move mr-2 text-gray-400 flex-shrink-0">
        <GripVertical size={16} />
      </span>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-center">
          {!readOnly && field._originalIndex >= 0 ? (
            <input 
              type="text" 
              className="bg-transparent border-0 border-b border-dashed border-gray-300 focus:ring-0 focus:border-blue-500 p-0 text-xs font-medium text-gray-700 w-full truncate" 
              placeholder={t('Field Label')}
              {...register(`${fieldname}.${field._originalIndex}.label`)}
            />
          ) : (
            <span className="text-xs font-medium text-gray-700 w-full truncate">{field.label}</span>
          )}
        </div>
        
        <div className="mt-2 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-500 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <span>{field.fieldname || 'field_name'}</span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase">{field.fieldtype}</span>
          </div>
        </div>
      </div>
      
      {!readOnly && field._originalIndex >= 0 && (
        <button 
          type="button"
          onClick={() => handleDelete(field._originalIndex)}
          className="text-gray-400 hover:text-red-500 ml-2 opacity-0 group-hover/field:opacity-100 transition-opacity flex-shrink-0"
          title={t('Delete Field')}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
