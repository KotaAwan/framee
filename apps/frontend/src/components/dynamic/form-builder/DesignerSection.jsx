import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import clsx from 'clsx';
import DesignerTab from './DesignerTab';

export default function DesignerSection({ 
  fieldname, 
  section, 
  register, 
  readOnly, 
  handleDelete, 
  handleAddTab, 
  handleAddColumn, 
  handleAddField,
  toggleSectionHeader,
  handleAddSection,
  fieldsLength,
  activeTabIds,
  setActiveTabIds,
  handleEdit
}) {
  const { t } = useTranslation();

  const hasHeader = section._originalIndex >= 0 && section.label !== undefined && section.label !== '';
  const isVirtualSection = section.id && section.id.toString().startsWith('virtual-section');

  return (
    <div className="bg-(--color-surface) border border-dashed border-(--color-border) p-4 rounded-md relative my-4">
      {/* 1. Header Bar: Add Header (left) & Delete Section (right) */}
      <div className="flex items-center justify-between pb-3 border-b border-(--color-border)">
        <div className="flex items-center gap-2">
          <span className="cursor-move text-(--color-muted)">
            <GripVertical size={16} />
          </span>
          {!readOnly && !isVirtualSection && (
            <>
              {!hasHeader && (
                <button 
                  type="button" 
                  onClick={() => toggleSectionHeader(section)} 
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  {t('Add Header')}
                </button>
              )}
              {hasHeader && (
                <div className="flex items-center gap-2 max-w-md sm:max-w-xl">
                  <input 
                    type="text" 
                    className="bg-transparent border-0 border-b border-dashed border-(--color-border) focus:ring-0 focus:border-blue-500 p-0 text-sm font-semibold w-full text-blue-600 dark:text-blue-400" 
                    placeholder={t('Section Name')}
                    {...register(`${fieldname}.${section._originalIndex}.label`)}
                  />
                  <button type="button" onClick={() => toggleSectionHeader(section)} className="text-(--color-muted) hover:text-red-500 shrink-0" title={t('Remove Header')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!readOnly && section._originalIndex >= 0 && (
          <button 
            type="button"
            onClick={() => handleDelete(section._originalIndex)}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1 bg-red-50 dark:bg-red-950/40 rounded border border-dashed border-red-200 dark:border-red-800 transition-colors"
          >
            {t('Delete Section')}
          </button>
        )}
      </div>

      {/* 2. Add Tab Row & Tab Headers */}
      <div className="border-b border-(--color-border) pt-2 pb-1 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-1">
          {section.tabs.map((tab, tIdx) => {
            const isVirtualTab = tab.id && tab.id.toString().startsWith('virtual-tab');
            const isActive = activeTabIds[section.id] ? activeTabIds[section.id] === tab.id : tIdx === 0;
            
            if (section.tabs.length === 1 && isVirtualTab) return null;

            return (
              <div 
                key={`tab_${tIdx}`}
                className={clsx(
                  "flex-shrink-0 cursor-pointer flex items-center px-3 py-1.5 border-b-2 font-medium text-xs rounded-t-md transition-colors",
                  isActive ? "border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/40" : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                )}
                onClick={() => setActiveTabIds(prev => ({...prev, [section.id]: tab.id}))}
              >
                <span className="cursor-move mr-1.5 text-(--color-muted)">
                  <GripVertical size={14} />
                </span>
                {!readOnly && !isVirtualTab ? (
                  <input 
                    type="text" 
                    className="bg-transparent border-0 border-b border-dashed border-(--color-border) focus:ring-0 focus:border-purple-500 p-0 text-xs font-bold w-24 text-purple-700 dark:text-purple-300" 
                    placeholder={t('Tab Name')}
                    onClick={e => e.stopPropagation()}
                    {...register(`${fieldname}.${tab._originalIndex}.label`)}
                  />
                ) : (
                  <span className="text-xs font-bold">{tab.label || t('Tab')}</span>
                )}
                {!readOnly && !isVirtualTab && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(tab._originalIndex); }} className="ml-2 text-(--color-muted) hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div className="px-2 shrink-0">
            <button 
              type="button" 
              onClick={() => handleAddTab(section._originalIndex >= 0 ? section._originalIndex : fieldsLength - 1)} 
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
            >
              {t('Add Tab')}
            </button>
          </div>
        )}
      </div>

      {/* 3. Add Column Row (Right Aligned) */}
      {!readOnly && (
        <div className="flex justify-end pt-2 pb-1">
          <button 
            type="button" 
            onClick={() => {
              const activeTabId = activeTabIds[section.id];
              const activeTab = section.tabs.find(t => t.id === activeTabId) || section.tabs[0];
              
              let targetIndex = section._originalIndex >= 0 ? section._originalIndex : fieldsLength - 1;
              if (activeTab) {
                let lastIndex = activeTab._originalIndex;
                activeTab.columns.forEach(c => {
                  if (c._originalIndex > lastIndex) lastIndex = c._originalIndex;
                  c.fields.forEach(f => {
                    if (f._originalIndex > lastIndex) lastIndex = f._originalIndex;
                  });
                });
                if (lastIndex >= 0) targetIndex = lastIndex;
              }
              handleAddColumn(targetIndex);
            }} 
            className="text-xs text-green-600 dark:text-green-400 hover:underline font-semibold"
          >
            {t('Add Column')}
          </button>
        </div>
      )}

      {/* 4. Tab Content & Fields Container */}
      <div className="mt-1">
        <div className="relative">
          {section.tabs.map((tab, tIdx) => {
            const isActive = activeTabIds[section.id] ? activeTabIds[section.id] === tab.id : tIdx === 0;
            if (!isActive) return null;

            return (
              <DesignerTab 
                key={`tab_content_${tIdx}`}
                fieldname={fieldname}
                tab={tab}
                section={section}
                register={register}
                readOnly={readOnly}
                handleDelete={handleDelete}
                handleAddColumn={handleAddColumn}
                handleAddField={handleAddField}
                handleEdit={handleEdit}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Add Field Box (Full Width Centered Dashed Box) */}
      {!readOnly && (
        <div className="mt-4 pt-2">
          <button 
            type="button" 
            onClick={() => handleAddField(section._originalIndex >= 0 ? section._originalIndex : fieldsLength - 1)} 
            className="w-full py-2.5 border border-dashed border-(--color-border) rounded-md text-xs text-(--color-muted) font-medium hover:text-(--color-text) hover:bg-(--color-surface-hover) transition-all text-center block"
          >
            + {t('Add Field')}
          </button>
        </div>
      )}
    </div>
  );
}
