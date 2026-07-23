import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import DesignerColumn from './DesignerColumn';

export default function DesignerTab({ fieldname, tab, section, register, readOnly, handleDelete, handleAddColumn, handleAddField, handleEdit }) {
  const { t } = useTranslation();

  return (
    <div className="p-2">
      
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
            handleEdit={handleEdit}
          />
        ))}
      </div>
    </div>
  );
}
