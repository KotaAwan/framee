import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useTranslation } from '@/hooks/useTranslation';
import clsx from 'clsx';
import DesignerTab from './DesignerTab';

export default function DesignerSection({ 
  fieldname, 
  section, 
  register, 
  readOnly, 
  handleDelete, 
  handleAddTab, 
  handleAddColumn, 
  handleAddField,
  toggleSectionHeader,
  handleAddSection,
  fieldsLength,
  activeTabIds,
  setActiveTabIds,
  handleEdit,
  dragHandleProps
}) {
  const { t } = useTranslation();

  const hasHeader = section._originalIndex >= 0 && section.label !== undefined && section.label !== '';
  const isVirtualSection = section.id && section.id.toString().startsWith('virtual-section');

  const activeTabId = activeTabIds[section.id];
  const activeTab = section.tabs.find(t => t.id === activeTabId) || section.tabs[0];
  const hasExplicitColumns = activeTab?.columns?.some(col => !col.id?.toString().startsWith('col-virt-'));

  const handleDeleteSectionBlock = () => {
    const indices = [];
    if (section._originalIndex >= 0) indices.push(section._originalIndex);
    for (const tab of section.tabs) {
      if (tab._originalIndex >= 0) indices.push(tab._originalIndex);
      for (const col of tab.columns) {
        if (col._originalIndex >= 0) indices.push(col._originalIndex);
        for (const f of col.fields) {
          if (f._originalIndex >= 0) indices.push(f._originalIndex);
        }
      }
    }
    handleDelete(indices, section.label || t('Section'));
  };

  const handleDeleteTabBlock = (tab) => {
    const indices = [];
    if (tab._originalIndex >= 0) indices.push(tab._originalIndex);
    for (const col of tab.columns) {
      if (col._originalIndex >= 0) indices.push(col._originalIndex);
      for (const f of col.fields) {
        if (f._originalIndex >= 0) indices.push(f._originalIndex);
      }
    }
    handleDelete(indices, tab.label || t('Tab'));
  };

  return (
    <div className="bg-(--color-surface) border border-(--color-border) p-4 rounded-md relative mt-1 mb-2">
      {/* 1. Header Bar: Add Header (left) & Delete Section (right) */}
      <div className="flex items-center justify-between pb-3 border-b border-(--color-border)">
        <div className="flex items-center gap-2">
          <span className="cursor-move text-(--color-muted) hover:text-(--color-text)" {...(dragHandleProps || {})}>
            <GripVertical size={16} />
          </span>
          {!readOnly && !isVirtualSection && (
            <>
              {!hasHeader && (
                <button 
                  type="button" 
                  onClick={() => toggleSectionHeader(section)} 
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  {t('Add Header')}
                </button>
              )}
              {hasHeader && (
                <div className="flex items-center gap-2 max-w-md sm:max-w-xl">
                  <input 
                    type="text" 
                    className="bg-transparent border-0 border-b border-dashed border-(--color-border) focus:ring-0 focus:border-blue-500 p-0 text-sm font-semibold w-full text-blue-600 dark:text-blue-400" 
                    placeholder={t('Section Name')}
                    {...register(`${fieldname}.${section._originalIndex}.label`)}
                  />
                  <button type="button" onClick={() => toggleSectionHeader(section)} className="text-(--color-muted) hover:text-red-500 shrink-0" title={t('Remove Header')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!readOnly && section._originalIndex >= 0 && (
          <button 
            type="button"
            onClick={handleDeleteSectionBlock}
            className="absolute top-0 right-0 px-2.5 py-1 text-[11px] font-medium text-red-500 dark:text-red-400 bg-red-500/[0.04] dark:bg-red-500/[0.08] border-b border-l border-(--color-border) rounded-bl-md hover:bg-red-500/[0.1] dark:hover:bg-red-500/[0.15] transition-colors z-10"
            title={t('Delete Section')}
          >
            {t('Delete Section')}
          </button>
        )}
      </div>

      {/* 2. Add Tab Row & Tab Headers */}
      <Droppable droppableId={`tabs_${section.id}`} direction="horizontal" type="TAB">
        {(provided) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="border-b border-(--color-border) pt-2 pb-1 flex items-center justify-between overflow-x-auto"
          >
            <div className="flex items-center gap-1">
              {section.tabs.map((tab, tIdx) => {
                const isVirtualTab = tab.id && tab.id.toString().startsWith('virtual-tab');
                const isActive = activeTabIds[section.id] ? activeTabIds[section.id] === tab.id : tIdx === 0;
                
                if (section.tabs.length === 1 && isVirtualTab) return null;

                return (
                  <Draggable 
                    key={`tab_drag_${tab.id}`} 
                    draggableId={`tab_${tab.id}`} 
                    index={tIdx}
                    isDragDisabled={readOnly || isVirtualTab || tab._originalIndex < 0}
                  >
                    {(dragProvided, snapshot) => (
                      <div 
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={clsx(
                          "flex-shrink-0 cursor-pointer flex items-center px-3 py-1.5 border-b-2 font-medium text-xs transition-colors",
                          isActive ? "border-purple-500 text-purple-600 dark:text-purple-400" : "border-transparent text-(--color-muted) hover:text-(--color-text)",
                          snapshot.isDragging && "opacity-70 bg-purple-50 dark:bg-purple-950/40 rounded"
                        )}
                        onClick={() => setActiveTabIds(prev => ({...prev, [section.id]: tab.id}))}
                      >
                        <span {...dragProvided.dragHandleProps} className="cursor-move mr-1.5 text-(--color-muted) hover:text-purple-600">
                          <GripVertical size={14} />
                        </span>
                        {!readOnly && !isVirtualTab ? (
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-dashed border-(--color-border) focus:ring-0 focus:border-purple-500 p-0 text-xs font-bold w-24 text-purple-700 dark:text-purple-300" 
                            placeholder={t('Tab Name')}
                            onClick={e => e.stopPropagation()}
                            {...register(`${fieldname}.${tab._originalIndex}.label`)}
                          />
                        ) : (
                          <span className="text-xs font-bold">{tab.label || t('Tab')}</span>
                        )}
                        {!readOnly && !isVirtualTab && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTabBlock(tab); }} className="ml-2 text-(--color-muted) hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>

            {!readOnly && (
              <div className="shrink-0 pl-2">
                <button 
                  type="button" 
                  onClick={() => handleAddTab(section.id)} 
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  {t('Add Tab')}
                </button>
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* 3. Add Column Row (Right Aligned) */}
      {!readOnly && (activeTab?.columns?.length || 0) < 3 && (
        <div className="flex justify-end pt-2 pb-1">
          <button 
            type="button" 
            onClick={() => {
              const hasExplicitCol = activeTab?.columns?.some(col => !col.id?.toString().startsWith('col-virt-'));
              let targetIndex;

              if (!hasExplicitCol) {
                // First explicit column in this tab: insert BEFORE the first field so fields fall into Column 1 (cukup 1 Column)
                let minFieldIdx = Infinity;
                if (activeTab?.columns) {
                  for (const col of activeTab.columns) {
                    if (col.fields) {
                      for (const f of col.fields) {
                        if (f._originalIndex >= 0 && f._originalIndex < minFieldIdx) {
                          minFieldIdx = f._originalIndex;
                        }
                      }
                    }
                  }
                }

                if (minFieldIdx !== Infinity) {
                  targetIndex = minFieldIdx;
                } else {
                  targetIndex = activeTab?._originalIndex >= 0 ? activeTab._originalIndex + 1 : (section._originalIndex >= 0 ? section._originalIndex + 1 : fieldsLength);
                }
              } else {
                // Tab already has explicit column(s): append new column after maxIdx in activeTab
                let maxIdx = -1;
                if (activeTab) {
                  if (activeTab._originalIndex >= 0) maxIdx = Math.max(maxIdx, activeTab._originalIndex);
                  if (activeTab.columns) {
                    for (const col of activeTab.columns) {
                      if (col._originalIndex >= 0) maxIdx = Math.max(maxIdx, col._originalIndex);
                      if (col.fields) {
                        for (const f of col.fields) {
                          if (f._originalIndex >= 0) maxIdx = Math.max(maxIdx, f._originalIndex);
                        }
                      }
                    }
                  }
                }

                if (maxIdx >= 0) {
                  targetIndex = maxIdx + 1;
                } else if (section._originalIndex >= 0) {
                  targetIndex = section._originalIndex + 1;
                } else {
                  targetIndex = fieldsLength;
                }
              }

              handleAddColumn(targetIndex);
            }} 
            className="text-xs text-green-600 dark:text-green-400 hover:underline font-semibold"
          >
            {t('Add Column')}
          </button>
        </div>
      )}

      {/* 4. Tab Content & Fields Container */}
      <div className="mt-1">
        <div className="relative">
          {section.tabs.map((tab, tIdx) => {
            const isActive = activeTabIds[section.id] ? activeTabIds[section.id] === tab.id : tIdx === 0;
            if (!isActive) return null;

            return (
              <DesignerTab 
                key={`tab_content_${tIdx}`}
                fieldname={fieldname}
                tab={tab}
                section={section}
                register={register}
                readOnly={readOnly}
                handleDelete={handleDelete}
                handleAddColumn={handleAddColumn}
                handleAddField={handleAddField}
                handleEdit={handleEdit}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Add Field Box (Full Width Centered Dashed Box) */}
      {!readOnly && !hasExplicitColumns && (
        <div className="mt-2 pt-1">
          <button 
            type="button" 
            onClick={() => handleAddField(section._originalIndex >= 0 ? section._originalIndex : fieldsLength - 1)} 
            className="w-full py-2.5 bg-(--color-surface-hover) border border-(--color-border) rounded-md text-xs text-(--color-muted) font-medium hover:text-(--color-text) transition-all text-center block"
          >
            {t('Add Field')}
          </button>
        </div>
      )}
    </div>
  );
}
