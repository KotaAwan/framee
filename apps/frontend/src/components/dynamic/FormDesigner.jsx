import React, { useMemo, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { useTranslation } from '@/hooks/useTranslation';
import { DragDropContext } from '@hello-pangea/dnd';
import DesignerSection from './form-builder/DesignerSection';
import FieldSettingsModal from './FieldSettingsModal';

export default function FormDesigner({ fieldname, control, register, readOnly }) {
  const { t } = useTranslation();
  const [activeTabIds, setActiveTabIds] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  
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
  
  const handleAddTab = (sectionAbsIndex) => {
    const targetIdx = sectionAbsIndex >= 0 ? sectionAbsIndex + 1 : fields.length;
    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `tab_${Math.random().toString(36).substring(2, 7)}`,
      label: 'New Tab',
      fieldtype: 'Tab Break'
    });
  };

  const handleAddColumn = (tabAbsIndex) => {
    const targetIdx = tabAbsIndex >= 0 ? tabAbsIndex + 1 : fields.length;
    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `col_${Math.random().toString(36).substring(2, 7)}`,
      label: 'New Column',
      fieldtype: 'Column Break'
    });
  };

  const handleAddField = (colAbsIndex) => {
    const targetIdx = colAbsIndex >= 0 ? colAbsIndex + 1 : fields.length;
    insert(targetIdx, {
      id: crypto.randomUUID(),
      fieldname: `field_${Math.random().toString(36).substring(2, 7)}`,
      label: 'New Field',
      fieldtype: 'Data'
    });
  };

  const handleDelete = (index) => {
    if (index >= 0 && !readOnly) {
      if (confirm(t('Remove this item?'))) {
        remove(index);
      }
    }
  };

  const toggleSectionHeader = (section) => {
    if (section._originalIndex >= 0 && !readOnly) {
       const hasLabel = section.label !== undefined && section.label !== '';
       update(section._originalIndex, {
         ...fields[section._originalIndex],
         label: hasLabel ? '' : 'Section'
       });
    }
  };

  const handleDragEnd = (result) => {};

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="w-full flex flex-col gap-2 min-h-[40px]">
        {structure.length === 0 && (
          <div className="text-center p-8 border border-dashed border-(--color-border) rounded-lg bg-(--color-surface-hover)">
            <p className="text-(--color-muted) mb-4">{t('No fields designed yet.')}</p>
          </div>
        )}

        <div className="space-y-2">
          {structure.map((section, sIdx) => (
            <DesignerSection 
              key={`sec_${sIdx}`}
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
            />
          ))}
        </div>

        {!readOnly && (
          <div className="mt-4 text-center pt-2 pb-4">
            <button 
              type="button" 
              onClick={handleAddSection} 
              className="inline-flex items-center px-4 py-2 border border-dashed border-gray-300 text-sm font-medium rounded-md text-gray-600 bg-white hover:bg-gray-50 focus:outline-none"
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
      </div>
    </DragDropContext>
  );
}
