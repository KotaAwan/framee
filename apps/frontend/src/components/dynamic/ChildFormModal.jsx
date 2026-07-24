import React, { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm as useRHF } from 'react-hook-form';
import apiClient from '../../lib/api.client';
import FormField from './FormField';
import { useTranslation } from '@/hooks/useTranslation';
import Icon from '../ui/Icon';

export default function ChildFormModal({ 
  isOpen, 
  onClose, 
  childDocType, 
  initialData, 
  onSave 
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [schema, setSchema] = useState([]);
  
  useEffect(() => {
    async function loadMeta() {
      if (!childDocType || !isOpen) return;
      setLoading(true);
      try {
        const metaRes = await apiClient.get(`/api/v1/meta/doctype/${childDocType}`);
        const metaData = metaRes.data?.data || {};
        setMeta(metaData);
        setSchema(metaData.fields || []);
      } catch (err) {
        console.error('Failed to load child metadata', err);
      } finally {
        setLoading(false);
      }
    }
    loadMeta();
  }, [childDocType, isOpen]);

  // Zod Schema (re-used from DynamicForm logic)
  const zodSchema = useMemo(() => {
    const shape = {};
    schema.forEach(field => {
      const isRequired = field.reqd || field.is_required;
      if (isRequired && !field.is_hidden) {
        if (field.fieldtype === 'Link') {
          shape[field.fieldname] = z.union([z.string(), z.number()]).refine(
            val => val !== undefined && val !== null && val !== '',
            { message: `${field.label} is required` }
          );
        } else if (['Data', 'Select', 'Text', 'Password'].includes(field.fieldtype)) {
          shape[field.fieldname] = z.string().min(1, { message: `${field.label} is required` });
        } else if (field.fieldtype === 'Check') {
          shape[field.fieldname] = z.boolean({ required_error: `${field.label} is required` });
        } else {
          shape[field.fieldname] = z.any().refine(
            val => val !== undefined && val !== null && val !== '',
            { message: `${field.label} is required` }
          );
        }
      } else {
        shape[field.fieldname] = z.any().optional().nullable();
      }
    });
    return z.object(shape);
  }, [schema]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors }
  } = useRHF({
    resolver: schema.length > 0 ? zodResolver(zodSchema) : undefined,
    defaultValues: initialData || {}
  });

  // Reset form when initialData or modal state changes
  useEffect(() => {
    if (isOpen) {
      reset(initialData || {});
    }
  }, [isOpen, initialData, reset]);

  const parsedColumns = useMemo(() => {
    const columns = [];
    let currentCol = [];
    
    schema.forEach(field => {
      if (field.is_hidden) return;
      if (childDocType === 'sys_docfield' && ['doctype', 'icon', 'sort_order'].includes(field.fieldname)) return;
      if (field.fieldtype === 'Column Break') {
        if (currentCol.length > 0) columns.push(currentCol);
        currentCol = [];
      } else if (field.fieldtype === 'Section Break') {
        if (currentCol.length > 0) columns.push(currentCol);
        currentCol = [];
        columns.push([field]);
        columns.push([]); // Start new column after section
        currentCol = columns[columns.length - 1];
      } else {
        currentCol.push(field);
      }
    });
    if (currentCol.length > 0) columns.push(currentCol);
    return columns;
  }, [schema, childDocType]);

  const onSubmit = (data) => {
    onSave(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-(--color-surface) rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-(--color-border)">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border) bg-(--color-section-header-bg)">
          <h2 className="text-lg font-bold text-(--color-text)">
            {childDocType === 'sys_docfield' ? t('Field Settings') : `${initialData ? t('Edit') : t('Add')} ${meta ? t(meta.label || meta.name) : childDocType}`}
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            className="text-(--color-muted) hover:text-(--color-text) transition-colors p-1"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-(--color-muted)">
              <Icon name="Loader2" size={32} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              
              {Object.keys(errors).length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-amber-500 p-3 rounded-r-md flex justify-between items-start">
                  <div className="flex gap-3">
                    <Icon name="AlertTriangle" size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-amber-800 dark:text-amber-400 font-medium text-sm mb-1">{t('Validation failed')}:</h4>
                      <ul className="text-amber-700 dark:text-amber-300 text-sm list-disc list-inside">
                        {Object.entries(errors).map(([key, err]) => (
                          <li key={key}>{err.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {parsedColumns.map((colFields, cIdx) => {
                    if (colFields.length === 1 && colFields[0].fieldtype === 'Section Break') {
                      return (
                        <div key={`sec_${cIdx}`} className="w-full border-b border-(--color-border) pb-2 mb-2 mt-4 flex-none">
                          <h3 className="text-lg font-semibold text-(--color-section-header-text)">{t(colFields[0].label)}</h3>
                        </div>
                      );
                    }
                    if (colFields.length === 0) return null;

                    return (
                      <div key={`col_${cIdx}`} className="flex-1 flex flex-col gap-4 w-full min-w-[250px]">
                        {colFields.map(field => {
                          // Visibility logic based on depends_on
                          if (field.depends_on) {
                            try {
                              let match = field.depends_on.match(/(\w+)\s*(==|!=)\s*['"]?([^'"]+)['"]?/);
                              if (match) {
                                const [_, depField, operator, targetValue] = match;
                                const currValue = watch(depField);
                                if (operator === '==' && currValue !== targetValue) return null;
                                if (operator === '!=' && currValue === targetValue) return null;
                               } else {
                                 // Safe evaluation
                                 try {
                                   const doc = watch();
                                   const isVisible = (function(doc) {
                                     try { return eval(field.depends_on); } catch(e) { return true; }
                                   })(doc);
                                   if (!isVisible) return null;
                                 } catch (e) {
                                   // Fallback visible on error
                                 }
                               }
                            } catch (err) {
                              // fallback visible
                            }
                          }

                          return (
                            <div key={field.id || field.fieldname} className="w-full">
                              <FormField
                                field={field}
                                register={register}
                                control={control}
                                error={errors[field.fieldname]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-(--color-border) bg-(--color-surface-hover) flex justify-end gap-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-(--color-text) bg-(--color-surface) border border-(--color-border) rounded-md hover:bg-(--color-background) transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
          >
            {childDocType === 'sys_docfield' ? t('Done') : t('Save')}
          </button>
        </div>
        
      </div>
    </div>
  );
}
