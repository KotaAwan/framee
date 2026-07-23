import React, { useState, useEffect } from 'react';
import { useFieldArray } from 'react-hook-form';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Edit2, Trash2 } from 'lucide-react';
import Icon from '../ui/Icon';
import ChildFormModal from './ChildFormModal';
import { useTranslation } from '@/hooks/useTranslation';
import apiClient from '../../lib/api.client';

export default function TableDocField({ fieldname, label, options, control, register, readOnly = false }) {
  const field = { fieldname, label, options }; // compatibility with previous TableField code
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [columns, setColumns] = useState([]);
  
  const { fields, append, update, remove, move } = useFieldArray({
    control,
    name: field.fieldname,
    keyName: '_ui_id' // React Hook Form's internal key to avoid conflict with our 'id'
  });

  const childDocType = field.options; // 'options' holds the target child DocType name

  // Fetch child metadata to determine columns for the grid
  useEffect(() => {
    async function loadColumns() {
      if (!childDocType) return;
      try {
        const res = await apiClient.get(`/api/v1/meta/doctype/${childDocType}`);
        const meta = res.data?.data;
        if (meta && meta.fields) {
          // Find fields configured to show in list view, limit to 4-5
          const listViewFields = meta.fields.filter(f => f.in_list_view === 1).slice(0, 5);
          // If none explicitly marked, just pick the first 3
          if (listViewFields.length === 0) {
            setColumns(meta.fields.filter(f => !f.is_hidden).slice(0, 3));
          } else {
            setColumns(listViewFields);
          }
        }
      } catch (e) {
        console.error('Failed to load columns for table', e);
      }
    }
    loadColumns();
  }, [childDocType]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (readOnly) return;
    move(result.source.index, result.destination.index);
  };

  const handleAdd = () => {
    if (readOnly) return;
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleSaveModal = (data) => {
    if (editingIndex !== null) {
      update(editingIndex, data);
    } else {
      append(data);
    }
  };

  const handleDelete = (index) => {
    if (readOnly) return;
    if (confirm(t('Are you sure you want to delete this row?'))) {
      remove(index);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center bg-(--color-section-header-bg) px-3 py-2 rounded-t-md border border-(--color-border) border-b-0">
        <label className="text-sm font-semibold text-(--color-section-header-text)">
          {t(field.label)}
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 bg-(--color-primary) text-white text-xs font-medium rounded hover:bg-(--color-primary-hover) transition-colors"
          >
            <Plus size={14} />
            {t('Add Row')}
          </button>
        )}
      </div>

      <div className="border border-(--color-border) rounded-b-md overflow-x-auto bg-(--color-surface)">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`droppable-${field.fieldname}`}>
            {(provided) => (
              <table 
                className="w-full text-sm text-left whitespace-nowrap"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                <thead className="text-xs text-(--color-muted) uppercase bg-(--color-surface-hover) border-b border-(--color-border)">
                  <tr>
                    {!readOnly && <th className="w-10 px-3 py-2 text-center">#</th>}
                    <th className="px-4 py-2 font-medium">{t('Label')}</th>
                    <th className="px-4 py-2 font-medium">{t('Field Name')}</th>
                    <th className="px-4 py-2 font-medium">{t('Type')}</th>
                    <th className="w-16 px-4 py-2 font-medium text-center">{t('Req')}</th>
                    {!readOnly && <th className="w-20 px-4 py-2 text-right">{t('Actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-(--color-muted) italic">
                        {t('No data available')}
                      </td>
                    </tr>
                  )}
                  {fields.map((item, index) => {
                    const isSystemLayoutField = ['Section Break', 'Tab Break', 'Column Break'].includes(item.fieldtype);
                    
                    return (
                    <Draggable key={item._ui_id} draggableId={item._ui_id} index={index} isDragDisabled={readOnly}>
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`border-b border-(--color-border) last:border-0 hover:bg-(--color-surface-hover) transition-colors ${
                            snapshot.isDragging ? 'bg-(--color-surface-hover) shadow-md z-10' : 'bg-(--color-surface)'
                          }`}
                        >
                          {!readOnly && (
                            <td className="px-3 py-2 text-center text-(--color-muted)">
                              <div className="flex items-center justify-center gap-2">
                                <div {...provided.dragHandleProps} className="cursor-grab hover:text-(--color-text)">
                                  <GripVertical size={16} />
                                </div>
                                <span>{index + 1}</span>
                              </div>
                            </td>
                          )}

                          {/* LABEL Column */}
                          <td className="px-2 py-1.5">
                            <input 
                              type="text" 
                              placeholder={t('Label')}
                              className={`w-full border rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 transition-colors ${
                                isSystemLayoutField ? 'font-bold text-gray-600 dark:text-gray-300' : ''
                              }`}
                              {...register(`${field.fieldname}.${index}.label`)}
                            />
                          </td>

                          {/* FIELD NAME Column */}
                          <td className="px-2 py-1.5">
                            <input 
                              type="text" 
                              placeholder={t('field_name')}
                              className="w-full border rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 transition-colors"
                              {...register(`${field.fieldname}.${index}.fieldname`)}
                            />
                          </td>

                          {/* TYPE Column */}
                          <td className="px-2 py-1.5">
                            <select 
                              className={`w-full border rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 font-semibold transition-colors ${
                                item.fieldtype === 'Section Break' ? 'text-blue-600' :
                                item.fieldtype === 'Column Break' ? 'text-green-600' :
                                item.fieldtype === 'Tab Break' ? 'text-purple-600' : 'text-gray-700 dark:text-gray-200'
                              }`}
                              {...register(`${field.fieldname}.${index}.fieldtype`)}
                            >
                              <option value="Data">Data (String)</option>
                              <option value="Text">Text</option>
                              <option value="Int">Int (Integer)</option>
                              <option value="Float">Float (Decimal)</option>
                              <option value="Check">Check (Boolean)</option>
                              <option value="Select">Select (Dropdown)</option>
                              <option value="Link">Link (Relation)</option>
                              <option value="Table">Table (Subgrid)</option>
                              <option value="Password">Password</option>
                              <option value="Date">Date</option>
                              <option value="Section Break">Section Break</option>
                              <option value="Tab Break">Tab Break</option>
                              <option value="Column Break">Column Break</option>
                            </select>
                          </td>

                          {/* REQ Column */}
                          <td className="px-4 py-2 text-center">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                              {...register(`${field.fieldname}.${index}.is_required`)} 
                            />
                          </td>

                          {/* ACTIONS Column (Gear & Delete) */}
                          {!readOnly && (
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isSystemLayoutField && (
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(index)}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                    title={t('Field Settings')}
                                  >
                                    <Icon name="Settings" size={16} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(index)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title={t('Delete')}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )}
                    </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </tbody>
              </table>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <ChildFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        childDocType={childDocType}
        initialData={editingIndex !== null ? fields[editingIndex] : null}
        onSave={handleSaveModal}
      />
    </div>
  );
}
