import React, { useMemo, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { useTranslation } from '@/hooks/useTranslation';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DesignerSection from './form-builder/DesignerSection';
import FieldSettingsModal from './FieldSettingsModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export default function FormDesigner({ fieldname, control, register, readOnly }) {
  const { t } = useTranslation();
  const [activeTabIds, setActiveTabIds] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState({ isOpen: false, targetIndices: [] });
  
  const { fields, append, remove, move, insert, update } = useFieldArray({
    control,
    name: fieldname,
    keyName: '_ui_id'
  });

  const handleEdit = (index) => {
    if (index >= 0 && !readOnly) {
      setEditingIndex(index);
      setIsModalOpen(true);
    }
  };

  const handleSaveModal = (data) => {
    if (editingIndex !== null) {
      update(editingIndex, {
        ...fields[editingIndex],
        ...data
      });
    }
  };

  const structure = useMemo(() => {
    const layout = [];
    let currentSection = null;
    let currentTab = null;
    let currentColumn = null;

    fields.forEach((field, index) => {
      const item = { ...field, _originalIndex: index };

      if (item.fieldtype === 'Section Break') {
        currentSection = { ...item, id: item._ui_id || `sec_${index}`, tabs: [] };
        layout.push(currentSection);
        currentTab = null;
        currentColumn = null;
      } else if (item.fieldtype === 'Tab Break') {
        if (!currentSection) {
          currentSection = { id: `virtual-section-${index}`, fieldname: `section_${index}`, label: '', fieldtype: 'Section Break', tabs: [], _originalIndex: -1 };
          layout.push(currentSection);
        }
        currentTab = { ...item, id: item._ui_id || `tab_${index}`, columns: [] };
        currentSection.tabs.push(currentTab);
        currentColumn = null;
      } else if (item.fieldtype === 'Column Break') {
        if (!currentSection) {
          currentSection = { id: `virtual-section-${index}`, fieldname: `section_${index}`, label: '', fieldtype: 'Section Break', tabs: [], _originalIndex: -1 };
          layout.push(currentSection);
        }
        if (!currentTab) {
          currentTab = { id: `virtual-tab-${index}`, fieldname: `tab_${index}`, label: '', fieldtype: 'Tab Break', columns: [], _originalIndex: -1 };
          currentSection.tabs.push(currentTab);
        }
        currentColumn = { ...item, id: item._ui_id || `col_${index}`, fields: [] };
        currentTab.columns.push(currentColumn);
      } else {
        if (!currentSection) {
          currentSection = { id: `virtual-section-${index}`, fieldname: `section_${index}`, label: '', fieldtype: 'Section Break', tabs: [], _originalIndex: -1 };
          layout.push(currentSection);
        }
        if (!currentTab) {
          currentTab = { id: `virtual-tab-${index}`, fieldname: `tab_${index}`, label: '', fieldtype: 'Tab Break', columns: [], _originalIndex: -1 };
          currentSection.tabs.push(currentTab);
        }
        if (!currentColumn) {
          currentColumn = { id: `col-virt-${index}`, fieldname: `col_${index}`, label: '', fieldtype: 'Column Break', fields: [], _originalIndex: -1 };
          currentTab.columns.push(currentColumn);
        }
        currentColumn.fields.push(item);
      }
    });

    // Ensure every tab has at least 1 column (virtual fallback if all explicit columns deleted)
    layout.forEach(sec => {
      sec.tabs.forEach(tab => {
        if (tab.columns.length === 0) {
          tab.columns.push({
            id: `col-virt-${sec.id}-${tab.id}`,
            fieldname: `col_virt`,
            label: '',
            fieldtype: 'Column Break',
            fields: [],
            _originalIndex: -1
          });
        }
      });
    });

    return layout;
  }, [fields]);

  const handleAddSection = () => {
    append({
      id: crypto.randomUUID(),
      fieldname: `section_${Math.random().toString(36).substring(2, 7)}`,
      label: '',
      fieldtype: 'Section Break'
    });
  };
  
  const handleAddTab = (sectionId) => {
    const sIdx = structure.findIndex(s => s.id === sectionId);
    if (sIdx === -1) return;

    const sec = structure[sIdx];
    const hasExplicitTab = sec.tabs.some(t => !t.id?.toString().startsWith('virtual-tab'));

    let targetIdx;
    if (!hasExplicitTab) {
      // First explicit tab in section: find smallest _originalIndex of all columns/fields in this section
      let minIdx = Infinity;
      for (const tab of sec.tabs) {
        for (const col of tab.columns) {
          if (col._originalIndex >= 0 && col._originalIndex < minIdx) {
            minIdx = col._originalIndex;
          }
          for (const f of col.fields) {
            if (f._originalIndex >= 0 && f._originalIndex < minIdx) {
              minIdx = f._originalIndex;
            }
          }
        }
      }

      if (minIdx !== Infinity) {
        targetIdx = minIdx;
      } else {
        targetIdx = sec._originalIndex >= 0 ? sec._originalIndex + 1 : 0;
      }
    } else {
      // Section already has explicit tabs: append at the end of section (on the right)
      targetIdx = fields.length;
      for (let i = sIdx + 1; i < structure.length; i++) {
        if (structure[i]._originalIndex >= 0) {
          targetIdx = structure[i]._originalIndex;
          break;
        }
      }
    }

    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `tab_${Math.random().toString(36).substring(2, 7)}`,
      label: t('New Tab'),
      fieldtype: 'Tab Break'
    });
  };

  const handleAddColumn = (targetIndex) => {
    const targetIdx = targetIndex >= 0 ? targetIndex : fields.length;
    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `col_${Math.random().toString(36).substring(2, 7)}`,
      label: t('New Column'),
      fieldtype: 'Column Break'
    });
  };

  const handleAddField = (colAbsIndex) => {
    const targetIdx = colAbsIndex >= 0 ? colAbsIndex + 1 : fields.length;
    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `field_${Math.random().toString(36).substring(2, 7)}`,
      label: t('New Field'),
      fieldtype: 'Data'
    });
  };

  const handleDelete = (target) => {
    let indices = [];
    if (Array.isArray(target)) {
      indices = target.filter(i => typeof i === 'number' && i >= 0);
    } else if (typeof target === 'number' && target >= 0) {
      indices = [target];
    }

    if (indices.length > 0 && !readOnly) {
      setDeleteConfirmState({
        isOpen: true,
        targetIndices: indices
      });
    }
  };

  const toggleSectionHeader = (section) => {
    if (section._originalIndex >= 0 && !readOnly) {
       const hasLabel = section.label !== undefined && section.label !== '';
       update(section._originalIndex, {
         ...fields[section._originalIndex],
         label: hasLabel ? '' : t('Section')
       });
    }
  };

  const handleDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.index === destination.index && source.droppableId === destination.droppableId) return;

    if (type === 'TAB') {
      const sectionId = source.droppableId.replace('tabs_', '');
      const sec = structure.find(s => s.id === sectionId);
      if (!sec) return;

      const nonVirtualTabs = sec.tabs.filter(t => !t.id?.toString().startsWith('virtual-tab'));
      const srcTab = nonVirtualTabs[source.index];
      const destTab = nonVirtualTabs[destination.index];

      if (srcTab && destTab && srcTab._originalIndex >= 0 && destTab._originalIndex >= 0) {
        move(srcTab._originalIndex, destTab._originalIndex);
      }
    } else if (type === 'SECTION') {
      const nonVirtualSections = structure.filter(s => !s.id?.toString().startsWith('virtual-section'));
      const srcSec = nonVirtualSections[source.index];
      const destSec = nonVirtualSections[destination.index];

      if (srcSec && destSec && srcSec._originalIndex >= 0 && destSec._originalIndex >= 0) {
        move(srcSec._originalIndex, destSec._originalIndex);
      }
    } else if (type === 'COLUMN') {
      const parts = source.droppableId.split('_');
      const sectionId = parts[1];
      const tabId = parts[2];

      const sec = structure.find(s => s.id === sectionId);
      const tab = sec?.tabs?.find(t => t.id === tabId);
      if (!tab || !tab.columns || tab.columns.length <= 1) return;

      // Reorder columns array
      const reorderedCols = Array.from(tab.columns);
      const [movedCol] = reorderedCols.splice(source.index, 1);
      reorderedCols.splice(destination.index, 0, movedCol);

      // Collect all old original indices belonging to this tab
      const oldIndices = [];
      tab.columns.forEach(col => {
        if (col._originalIndex >= 0) oldIndices.push(col._originalIndex);
        if (col.fields) {
          col.fields.forEach(f => {
            if (f._originalIndex >= 0) oldIndices.push(f._originalIndex);
          });
        }
      });
      oldIndices.sort((a, b) => a - b);

      if (oldIndices.length === 0) return;

      // Build new flat items array for the reordered columns
      const newItems = [];

      reorderedCols.forEach((col, i) => {
        let colBreak = col._originalIndex >= 0 ? fields[col._originalIndex] : null;
        if (!colBreak && i > 0) {
          colBreak = {
            id: crypto.randomUUID(),
            fieldname: `col_${Math.random().toString(36).substring(2, 7)}`,
            label: 'New Column',
            fieldtype: 'Column Break'
          };
        }

        if (i > 0 && colBreak) {
          newItems.push(colBreak);
        }

        if (col.fields) {
          col.fields.forEach(f => {
            if (f._originalIndex >= 0 && fields[f._originalIndex]) {
              newItems.push(fields[f._originalIndex]);
            }
          });
        }
      });

      // Update fields array in-place for all oldIndices
      for (let k = 0; k < oldIndices.length; k++) {
        if (k < newItems.length) {
          update(oldIndices[k], newItems[k]);
        }
      }
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="w-full flex flex-col gap-2 min-h-[40px]">
        {structure.length === 0 && (
          <div className="text-center p-8 border border-dashed border-(--color-border) rounded-lg bg-(--color-surface-hover)">
            <p className="text-(--color-muted) mb-4">{t('No fields designed yet.')}</p>
          </div>
        )}

        <Droppable droppableId="all_sections" type="SECTION">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {structure.map((section, sIdx) => {
                const isVirtualSection = section.id && section.id.toString().startsWith('virtual-section');

                return (
                  <Draggable 
                    key={`sec_drag_${section.id}`} 
                    draggableId={`sec_${section.id}`} 
                    index={sIdx}
                    isDragDisabled={readOnly || isVirtualSection || section._originalIndex < 0}
                  >
                    {(dragProvided) => (
                      <div 
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                      >
                        <DesignerSection 
                          fieldname={fieldname}
                          section={section}
                          register={register}
                          readOnly={readOnly}
                          handleDelete={handleDelete}
                          handleAddTab={handleAddTab}
                          handleAddColumn={handleAddColumn}
                          handleAddField={handleAddField}
                          toggleSectionHeader={toggleSectionHeader}
                          handleAddSection={handleAddSection}
                          fieldsLength={fields.length}
                          activeTabIds={activeTabIds}
                          setActiveTabIds={setActiveTabIds}
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

        {/* Global Add Section Button (Bottom) */}
        {!readOnly && (
          <div className="mt-0 text-center pb-4 pt-1 flex justify-center">
            <button 
              type="button" 
              onClick={handleAddSection} 
              className="inline-flex items-center justify-center text-center leading-none px-4 py-2 bg-blue-500/[0.05] dark:bg-blue-500/[0.1] text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 text-xs font-semibold rounded-md hover:bg-blue-500/[0.12] dark:hover:bg-blue-500/[0.2] transition-colors focus:outline-none"
            >
              {t('Add Section')}
            </button>
          </div>
        )}

        <FieldSettingsModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingIndex !== null ? fields[editingIndex] : null}
          onSave={handleSaveModal}
        />

        {deleteConfirmState.isOpen && (
          <div 
            onClick={() => setDeleteConfirmState({ isOpen: false, targetIndices: [] })}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-(--color-surface) rounded-lg shadow-xl w-full max-w-md p-6 border border-(--color-border) flex flex-col gap-6 animate-in zoom-in-95 duration-200"
            >
              <p className="text-sm font-medium text-(--color-text)">
                {t('Are your sure you want to delete this data ?', 'Are your sure you want to delete this data ?')}
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirmState({ isOpen: false, targetIndices: [] })}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (deleteConfirmState.targetIndices && deleteConfirmState.targetIndices.length > 0) {
                      const sortedIndices = [...deleteConfirmState.targetIndices].sort((a, b) => b - a);
                      sortedIndices.forEach(idx => remove(idx));
                    }
                    setDeleteConfirmState({ isOpen: false, targetIndices: [] });
                  }}
                >
                  {t('Delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}
