import React, { useState, useEffect } from 'react';
import { useFieldArray } from 'react-hook-form';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Edit2, Trash2 } from 'lucide-react';
import Icon from '../ui/Icon';
import ChildFormModal from './ChildFormModal';
import FieldSettingsModal from './FieldSettingsModal';
import { useTranslation } from '@/hooks/useTranslation';
import apiClient from '../../lib/api.client';
import { Button } from '../ui/Button';

export default function TableDocField({ fieldname, label, options, control, register, readOnly = false }) {
  const field = { fieldname, label, options }; // compatibility with previous TableField code
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [columns, setColumns] = useState([]);
  const [deleteConfirmState, setDeleteConfirmState] = useState({ isOpen: false, targetIndices: [] });
  
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
    if (childDocType === 'sys_docfield' || field.fieldname === 'fields') {
      append({
        id: crypto.randomUUID(),
        fieldname: `field_${Math.random().toString(36).substring(2, 7)}`,
        label: t('New Field'),
        fieldtype: 'Data'
      });
    } else {
      setEditingIndex(null);
      setIsModalOpen(true);
    }
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
    setDeleteConfirmState({ isOpen: true, targetIndices: [index] });
  };

  return (
    <div className="w-full flex flex-col">
      <div className="border border-(--color-border) rounded-md overflow-x-auto bg-(--color-surface)">
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
                    <th className="w-16 px-4 py-2 font-medium text-center">{t('REQ')}</th>
                    {!readOnly && <th className="w-20 px-4 py-2 text-right">{t('ACTIONS')}</th>}
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
                              placeholder={t('Field Name')}
                              className="w-full border rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 transition-colors"
                              {...register(`${field.fieldname}.${index}.fieldname`)}
                            />
                          </td>

                          {/* TYPE Column */}
                          <td className="px-2 py-1.5">
                            <select 
                              className={`w-full border border-gray-200/60 dark:border-gray-700/60 rounded-md p-1.5 text-sm bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 font-semibold transition-colors ${
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
                  {!readOnly && (
                    <tr className="border-t border-(--color-border) bg-(--color-surface)">
                      <td colSpan={6} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={handleAdd}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/[0.05] dark:bg-blue-500/[0.1] text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 text-xs font-semibold rounded-md hover:bg-blue-500/[0.12] dark:hover:bg-blue-500/[0.2] transition-colors"
                        >
                          <Plus size={14} />
                          {t('Add Row')}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {childDocType === 'sys_docfield' || field.fieldname === 'fields' ? (
        <FieldSettingsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingIndex !== null ? fields[editingIndex] : null}
          onSave={handleSaveModal}
        />
      ) : (
        <ChildFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          childDocType={childDocType}
          initialData={editingIndex !== null ? fields[editingIndex] : null}
          onSave={handleSaveModal}
        />
      )}

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
  );
}
