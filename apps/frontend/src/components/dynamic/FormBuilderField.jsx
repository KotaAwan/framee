import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import TableDocField from './TableDocField';
import FormDesigner from './FormDesigner';
import clsx from 'clsx';

export default function FormBuilderField({ fieldname, label, options, control, register, readOnly = false }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('design'); // 'design' or 'setup'

  return (
    <div className="w-full bg-white shadow sm:rounded-lg mb-6 border border-gray-200 overflow-hidden mt-6">
      {/* Tabs Header */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('design')}
            className={clsx(
              'w-1/2 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors',
              activeTab === 'design'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {t('Form Design')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={clsx(
              'w-1/2 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors',
              activeTab === 'setup'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {t('Fields Setup')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50">
        {activeTab === 'design' && (
          <div className="w-full p-6 sm:p-4">
            <FormDesigner 
              fieldname={fieldname}
              control={control}
              register={register}
              readOnly={readOnly}
            />
          </div>
        )}
        {activeTab === 'setup' && (
          <div className="w-full">
            <TableDocField 
              fieldname={fieldname} 
              label={label} 
              options={options} 
              control={control} 
              register={register}
              readOnly={readOnly} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
