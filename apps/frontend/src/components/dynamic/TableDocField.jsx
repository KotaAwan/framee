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
                    {columns.map(col => (
                      <th key={col.fieldname} className="px-4 py-2 font-medium">{t(col.label)}</th>
                    ))}
                    {!readOnly && <th className="w-20 px-4 py-2 text-right">{t('Actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-4 py-6 text-center text-(--color-muted) italic">
                        {t('No data available')}
                      </td>
                    </tr>
                  )}
                  {fields.map((item, index) => (
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
                              <div {...provided.dragHandleProps} className="flex justify-center cursor-grab hover:text-(--color-text)">
                                <GripVertical size={16} />
                              </div>
                            </td>
                          )}
                          
                          {columns.map(col => {
                            if (readOnly) {
                              let val = item[col.fieldname];
                              if (typeof val === 'boolean' || val === 1 || val === 0) {
                                val = val ? 'Yes' : 'No';
                              }
                              return (
                                <td key={col.fieldname} className="px-4 py-2 text-(--color-text) truncate max-w-[200px]" title={val}>
                                  {val}
                                </td>
                              );
                            }

                            // Editable Inline Mode
                            if (col.fieldtype === 'Check') {
                              return (
                                <td key={col.fieldname} className="px-4 py-2 text-center">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    {...register(`${field.fieldname}.${index}.${col.fieldname}`)} 
                                  />
                                </td>
                              );
                            } else if (col.fieldtype === 'Select') {
                              const opts = Array.isArray(col.options) 
                                ? col.options 
                                : (col.options || '').split('\n').filter(Boolean);
                              return (
                                <td key={col.fieldname} className="px-2 py-1">
                                  <select 
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-colors" 
                                    {...register(`${field.fieldname}.${index}.${col.fieldname}`)}
                                  >
                                    <option value="">-</option>
                                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </td>
                              );
                            } else {
                              return (
                                <td key={col.fieldname} className="px-2 py-1">
                                  <input 
                                    type="text" 
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-colors" 
                                    {...register(`${field.fieldname}.${index}.${col.fieldname}`)} 
                                  />
                                </td>
                              );
                            }
                          })}

                          {!readOnly && (
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(index)}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                  title={t('Settings')}
                                >
                                  <Icon name="Settings" size={16} />
                                </button>
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
                  ))}
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
