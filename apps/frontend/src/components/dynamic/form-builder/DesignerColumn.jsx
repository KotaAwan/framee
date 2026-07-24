import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import clsx from 'clsx';
import DesignerField from './DesignerField';

export default function DesignerColumn({ fieldname, col, tab, section, register, readOnly, handleDelete, handleAddField, handleEdit, dragHandleProps }) {
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

  // Determine if delete button should be shown for this column
  const canDeleteColumn = !readOnly && !isVirtualCol && (
    col._originalIndex >= 0 || 
    (tab?.columns?.length > 1 && tab.columns.some(c => c._originalIndex >= 0))
  );

  const handleDeleteColumn = () => {
    const indices = [];
    if (col._originalIndex >= 0) {
      indices.push(col._originalIndex);
    } else {
      // Find the first explicit Column Break in this tab
      const nextExplicitCol = tab?.columns?.find(c => c._originalIndex >= 0);
      if (nextExplicitCol) {
        indices.push(nextExplicitCol._originalIndex);
      }
    }
    // Include all fields inside this column block
    if (col.fields) {
      for (const f of col.fields) {
        if (f._originalIndex >= 0) {
          indices.push(f._originalIndex);
        }
      }
    }
    handleDelete(indices, col.label || t('Column'));
  };

  return (
    <div className={clsx("min-h-[50px] flex flex-col relative group/col", isVirtualCol ? "" : "border border-gray-500/[0.12] dark:border-gray-500/[0.15] rounded-md p-2")}>
      
      {!isVirtualCol && (
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" {...(dragHandleProps || {})}>
              <GripVertical size={13} />
            </span>
            <div className="text-xs text-gray-200 dark:text-gray-600 font-normal">{t('Column')}</div>
          </div>
          {canDeleteColumn && (
            <button type="button" onClick={handleDeleteColumn} className="text-gray-400 hover:text-red-500 transition-opacity" title={t('Delete Column')}>
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
            handleEdit={handleEdit}
          />
        ))}
      </div>
      
      {!readOnly && !isVirtualCol && (
        <button 
          type="button" 
          onClick={() => handleAddField(colAppendIndex)} 
          className="mt-2 w-full text-center text-xs font-medium text-(--color-muted) border border-(--color-border) rounded py-1.5 bg-(--color-surface-hover) hover:text-(--color-text) transition-colors"
        >
          {t('Add Field')}
        </button>
      )}
    </div>
  );
}
