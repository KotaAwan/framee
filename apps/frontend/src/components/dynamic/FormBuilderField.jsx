import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import TableDocField from './TableDocField';
import FormDesigner from './FormDesigner';
import clsx from 'clsx';

export default function FormBuilderField({ fieldname, label, options, control, register, readOnly = false }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('design'); // 'design' or 'setup'

  return (
    <div className="w-full bg-(--color-surface) shadow-sm rounded-lg border border-(--color-border) overflow-hidden mt-2">
      {/* Tabs Header */}
      <div className="border-b border-(--color-border) bg-(--color-section-header-bg)">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('design')}
            className={clsx(
              'w-1/2 py-3 px-6 text-center border-b-2 font-semibold text-sm transition-colors',
              activeTab === 'design'
                ? 'border-(--color-primary) text-(--color-primary)'
                : 'border-transparent text-(--color-muted) hover:text-(--color-text) hover:border-(--color-border)'
            )}
          >
            {t('Form Design')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={clsx(
              'w-1/2 py-3 px-6 text-center border-b-2 font-semibold text-sm transition-colors',
              activeTab === 'setup'
                ? 'border-(--color-primary) text-(--color-primary)'
                : 'border-transparent text-(--color-muted) hover:text-(--color-text) hover:border-(--color-border)'
            )}
          >
            {t('Fields Setup')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-(--color-surface)">
        {activeTab === 'design' && (
          <div className="w-full p-4">
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
