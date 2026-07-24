import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from '@/hooks/useTranslation';
import Icon from '../ui/Icon';

export default function FieldSettingsModal({ isOpen, onClose, initialData, onSave }) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      label: 'Label',
      fieldname: 'FieldName',
      ...(initialData || {})
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        label: initialData?.label || 'Label',
        fieldname: initialData?.fieldname || 'FieldName',
        is_required: initialData?.is_required || false,
        is_read_only: initialData?.is_read_only ?? initialData?.read_only ?? false,
        is_hidden: initialData?.is_hidden || false,
        is_unique: initialData?.is_unique || false,
        is_indexed: initialData?.is_indexed || false,
        ...(initialData || {})
      });
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const onSubmit = (data) => {
    const formattedData = {
      ...data,
      is_read_only: data.is_read_only ?? data.read_only,
    };
    onSave(formattedData);
    onClose();
  };

  const inputClassName = "w-full border border-(--color-border) rounded-md px-3 py-2 bg-(--color-surface) text-(--color-text) focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors";
  const labelClassName = "block font-medium text-(--color-text) text-xs mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-(--color-surface) rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-(--color-border) animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border)">
          <h2 className="text-lg font-bold text-(--color-text)">
            {t('Field Settings')}
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            className="text-(--color-muted) hover:text-(--color-text) transition-colors p-1"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            
            {/* Label */}
            <div>
              <label className={labelClassName}>{t('Label')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('label')}
              />
            </div>

            {/* Placeholder */}
            <div>
              <label className={labelClassName}>{t('Placeholder')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('placeholder')}
              />
            </div>

            {/* Name (Fieldname) */}
            <div>
              <label className={labelClassName}>{t('Name (Fieldname)')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('fieldname')}
              />
            </div>

            {/* Help Text */}
            <div>
              <label className={labelClassName}>
                {t('Help Text')} <span className="text-(--color-muted) font-normal text-xs">(hyperlink url)</span>
              </label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('doc_url')}
              />
            </div>

            {/* Type (Fieldtype) */}
            <div>
              <label className={labelClassName}>{t('Type (Fieldtype)')}</label>
              <select 
                className={`${inputClassName} cursor-pointer`}
                {...register('fieldtype')}
              >
                <option value="Data" className="bg-(--color-surface) text-(--color-text) py-1">{t('Data (String)')}</option>
                <option value="Text" className="bg-(--color-surface) text-(--color-text) py-1">{t('Text')}</option>
                <option value="Int" className="bg-(--color-surface) text-(--color-text) py-1">{t('Int (Integer)')}</option>
                <option value="Float" className="bg-(--color-surface) text-(--color-text) py-1">{t('Float (Decimal)')}</option>
                <option value="Check" className="bg-(--color-surface) text-(--color-text) py-1">{t('Check (Boolean)')}</option>
                <option value="Select" className="bg-(--color-surface) text-(--color-text) py-1">{t('Select (Dropdown)')}</option>
                <option value="Link" className="bg-(--color-surface) text-(--color-text) py-1">{t('Link (Relation)')}</option>
                <option value="Table" className="bg-(--color-surface) text-(--color-text) py-1">{t('Table (Subgrid)')}</option>
                <option value="Password" className="bg-(--color-surface) text-(--color-text) py-1">{t('Password')}</option>
                <option value="Date" className="bg-(--color-surface) text-(--color-text) py-1">{t('Date')}</option>
                <option value="Section Break" className="bg-(--color-surface) text-(--color-text) py-1">{t('Section Break')}</option>
                <option value="Tab Break" className="bg-(--color-surface) text-(--color-text) py-1">{t('Tab Break')}</option>
                <option value="Column Break" className="bg-(--color-surface) text-(--color-text) py-1">{t('Column Break')}</option>
              </select>
            </div>

            {/* Width */}
            <div>
              <label className={labelClassName}>{t('Width')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('width')}
              />
            </div>

            {/* Options */}
            <div>
              <label className={labelClassName}>{t('Options')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('options')}
              />
            </div>

            {/* Checkboxes Group */}
            <div className="row-span-2 flex flex-col justify-center space-y-2 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-(--color-border) text-blue-600 focus:ring-blue-500" {...register('is_required')} />
                <span className="text-(--color-text) text-xs">{t('Mandatory')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-(--color-border) text-blue-600 focus:ring-blue-500" {...register('is_unique')} />
                <span className="text-(--color-text) text-xs">{t('Unique')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-(--color-border) text-blue-600 focus:ring-blue-500" {...register('is_indexed')} />
                <span className="text-(--color-text) text-xs">{t('Indexed')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-(--color-border) text-blue-600 focus:ring-blue-500" {...register('is_read_only')} />
                <span className="text-(--color-text) text-xs">{t('Read Only')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-(--color-border) text-blue-600 focus:ring-blue-500" {...register('is_hidden')} />
                <span className="text-(--color-text) text-xs">{t('Hidden')}</span>
              </label>
            </div>

            {/* Default Value */}
            <div>
              <label className={labelClassName}>{t('Default Value')}</label>
              <input 
                type="text" 
                className={inputClassName}
                {...register('default_value')}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-(--color-border) flex justify-end">
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors"
            >
              {t('Done')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
