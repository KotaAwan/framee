import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import clsx from 'clsx';
import DesignerField from './DesignerField';

export default function DesignerColumn({ fieldname, col, tab, section, register, readOnly, handleDelete, handleAddField }) {
  const { t } = useTranslation();
  
  const isVirtualCol = tab.columns.length === 1 && col.id && col.id.toString().startsWith('col-virt-');
  
  // Logic to determine where to append the field
  const colAppendIndex = col.fields.length > 0 
    ? col.fields[col.fields.length - 1]._originalIndex 
    : (col._originalIndex >= 0 
        ? col._originalIndex 
        : (tab._originalIndex >= 0 
            ? tab._originalIndex 
            : section._originalIndex));

  return (
    <div className={clsx("min-h-[50px] flex flex-col relative group/col", isVirtualCol ? "" : "bg-white border border-gray-200 rounded-md p-2")}>
      
      {!isVirtualCol && (
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-gray-400 font-semibold">{t('Column')}</div>
          {!readOnly && col._originalIndex >= 0 && (
            <button type="button" onClick={() => handleDelete(col._originalIndex)} className="text-gray-400 hover:text-red-500 transition-opacity">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
      
      <div className="space-y-2 flex-grow min-h-[50px]">
        {col.fields.map((field, fIdx) => (
          <DesignerField 
            key={`field_${fIdx}`}
            fieldname={fieldname}
            field={field}
            register={register}
            readOnly={readOnly}
            handleDelete={handleDelete}
          />
        ))}
      </div>
      
      {!readOnly && (
        <button 
          type="button" 
          onClick={() => handleAddField(colAppendIndex)} 
          className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded py-1 bg-gray-50 hover:bg-gray-100 transition"
        >
          <Plus size={12} className="inline mr-1" /> {t('Add Field')}
        </button>
      )}
    </div>
  );
}
