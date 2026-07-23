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
        ...(initialData || {})
      });
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const onSubmit = (data) => {
    onSave(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {t('Field Settings')}
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            
            {/* Label */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Label')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('label')}
              />
            </div>

            {/* Placeholder */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Placeholder')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('placeholder')}
              />
            </div>

            {/* Name (Fieldname) */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Name (Fieldname)')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('fieldname')}
              />
            </div>

            {/* Help Text */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                {t('Help Text')} <span className="text-gray-400 font-normal text-xs">(hyperlink url)</span>
              </label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('description')}
              />
            </div>

            {/* Type (Fieldtype) */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Type (Fieldtype)')}</label>
              <select 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                {...register('fieldtype')}
              >
                <option value="Data" className="bg-white text-gray-900 py-1">Data (String)</option>
                <option value="Text" className="bg-white text-gray-900 py-1">Text</option>
                <option value="Int" className="bg-white text-gray-900 py-1">Int (Integer)</option>
                <option value="Float" className="bg-white text-gray-900 py-1">Float (Decimal)</option>
                <option value="Check" className="bg-white text-gray-900 py-1">Check (Boolean)</option>
                <option value="Select" className="bg-white text-gray-900 py-1">Select (Dropdown)</option>
                <option value="Link" className="bg-white text-gray-900 py-1">Link (Relation)</option>
                <option value="Table" className="bg-white text-gray-900 py-1">Table (Subgrid)</option>
                <option value="Password" className="bg-white text-gray-900 py-1">Password</option>
                <option value="Date" className="bg-white text-gray-900 py-1">Date</option>
                <option value="Section Break" className="bg-white text-gray-900 py-1">Section Break</option>
                <option value="Tab Break" className="bg-white text-gray-900 py-1">Tab Break</option>
                <option value="Column Break" className="bg-white text-gray-900 py-1">Column Break</option>
              </select>
            </div>

            {/* Width */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Width')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('width')}
              />
            </div>

            {/* Options */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Options')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('options')}
              />
            </div>

            {/* Checkboxes Group */}
            <div className="row-span-2 flex flex-col justify-center space-y-2 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('is_required')} />
                <span className="text-gray-700">{t('Mandatory')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('is_unique')} />
                <span className="text-gray-700">{t('Unique')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('is_indexed')} />
                <span className="text-gray-700">{t('Indexed')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('read_only')} />
                <span className="text-gray-700">{t('Read Only')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('is_hidden')} />
                <span className="text-gray-700">{t('Hidden')}</span>
              </label>
            </div>

            {/* Default Value */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">{t('Default Value')}</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                {...register('default_value')}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors"
            >
              {t('Done')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
