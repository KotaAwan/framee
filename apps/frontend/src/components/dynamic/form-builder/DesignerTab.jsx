import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useTranslation } from '@/hooks/useTranslation';
import DesignerColumn from './DesignerColumn';

export default function DesignerTab({ fieldname, tab, section, register, readOnly, handleDelete, handleAddColumn, handleAddField, handleEdit }) {
  const { t } = useTranslation();

  return (
    <div className="p-2">
      <Droppable droppableId={`cols_${section.id}_${tab.id}`} direction="horizontal" type="COLUMN">
        {(provided) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="grid gap-4 items-start" 
            style={{ gridTemplateColumns: `repeat(${Math.max(1, tab.columns.length)}, minmax(0, 1fr))` }}
          >
            {tab.columns.map((col, cIdx) => {
              const isVirtualCol = tab.columns.length === 1 && col.id && col.id.toString().startsWith('col-virt-');

              return (
                <Draggable
                  key={`col_drag_${tab.id}_${cIdx}`}
                  draggableId={`col_${tab.id}_${col.id || cIdx}`}
                  index={cIdx}
                  isDragDisabled={readOnly || isVirtualCol || tab.columns.length <= 1}
                >
                  {(dragProvided) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      <DesignerColumn 
                        fieldname={fieldname}
                        col={col}
                        tab={tab}
                        section={section}
                        register={register}
                        readOnly={readOnly}
                        handleDelete={handleDelete}
                        handleAddField={handleAddField}
                        handleEdit={handleEdit}
                        dragHandleProps={dragProvided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
