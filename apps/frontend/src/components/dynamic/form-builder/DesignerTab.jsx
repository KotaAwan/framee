import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import DesignerColumn from './DesignerColumn';

export default function DesignerTab({ fieldname, tab, section, register, readOnly, handleDelete, handleAddColumn, handleAddField }) {
  const { t } = useTranslation();

  return (
    <div className="p-2">
      {!readOnly && (
        <div className="flex justify-end mb-2">
          <button 
            type="button" 
            onClick={() => handleAddColumn(tab._originalIndex >= 0 ? tab._originalIndex : section._originalIndex)} 
            className="text-xs text-green-600 hover:text-green-800 font-medium"
          >
            {t('Add Column')}
          </button>
        </div>
      )}
      
      {/* Columns Grid */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${Math.max(1, tab.columns.length)}, minmax(0, 1fr))` }}>
        {tab.columns.map((col, cIdx) => (
          <DesignerColumn 
            key={`col_${cIdx}`}
            fieldname={fieldname}
            col={col}
            tab={tab}
            section={section}
            register={register}
            readOnly={readOnly}
            handleDelete={handleDelete}
            handleAddField={handleAddField}
          />
        ))}
      </div>
    </div>
  );
}
