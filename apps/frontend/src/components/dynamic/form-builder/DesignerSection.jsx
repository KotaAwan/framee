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
  setActiveTabIds
}) {
  const { t } = useTranslation();

  const hasHeader = section._originalIndex >= 0 && section.label !== undefined && section.label !== '';
  const isVirtualSection = section.id && section.id.toString().startsWith('virtual-section');

  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 p-4 rounded-md relative group mt-8">
      
      {!readOnly && section._originalIndex >= 0 && (
        <button 
          type="button"
          onClick={() => handleDelete(section._originalIndex)}
          className="absolute top-0 right-0 text-xs text-red-500 hover:text-red-700 font-medium leading-none mb-0 px-3 py-1.5 bg-gray-50 border border-dashed border-gray-300 border-t-0 border-r-0 rounded-bl-md hover:bg-red-50 translate-y-[1px] transition-colors z-10"
        >
          {t('Delete Section')}
        </button>
      )}

      <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-4">
        <div className="flex items-center w-full">
          <span className="cursor-move mr-2 text-gray-400">
            <GripVertical size={16} />
          </span>
          
          {(!readOnly && !isVirtualSection) && (
            <div className="flex items-center w-full">
              {!hasHeader && (
                <button type="button" onClick={() => toggleSectionHeader(section)} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-2">
                  {t('Add Header')}
                </button>
              )}
              {hasHeader && (
                <>
                  <input 
                    type="text" 
                    className="bg-transparent border-0 border-b border-dashed border-gray-300 focus:ring-0 focus:border-blue-500 p-0 text-lg font-semibold w-full text-blue-600" 
                    placeholder={t('Section Name')}
                    {...register(`${fieldname}.${section._originalIndex}.label`)}
                  />
                  <button type="button" onClick={() => toggleSectionHeader(section)} className="ml-3 text-gray-400 hover:text-red-500" title={t('Remove Header')}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          )}
          {isVirtualSection && !readOnly && (
            <button type="button" onClick={() => handleAddSection()} className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1">
              {t('Add Header')}
            </button>
          )}
          {readOnly && !isVirtualSection && (
            <span className="text-lg font-semibold text-blue-600 w-full">{section.label || t('Section')}</span>
          )}
        </div>
      </div>

      <div className="design-tabs-container">
        <div className="border-b border-gray-200 mb-4 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center">
            {section.tabs.map((tab, tIdx) => {
              const isVirtualTab = tab.id && tab.id.toString().startsWith('virtual-tab');
              const isActive = activeTabIds[section.id] ? activeTabIds[section.id] === tab.id : tIdx === 0;
              
              if (section.tabs.length === 1 && isVirtualTab) return null;

              return (
                <div 
                  key={`tab_${tIdx}`}
                  className={clsx(
                    "flex-shrink-0 cursor-pointer flex items-center px-4 py-2 border-b-2 font-medium text-sm",
                    isActive ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                  onClick={() => setActiveTabIds(prev => ({...prev, [section.id]: tab.id}))}
                >
                  <span className="cursor-move mr-2 text-gray-400">
                    <GripVertical size={16} />
                  </span>
                  {!readOnly && !isVirtualTab ? (
                    <input 
                      type="text" 
                      className="bg-transparent border-0 border-b border-dashed border-gray-300 focus:ring-0 focus:border-purple-500 p-0 text-sm font-bold w-32" 
                      placeholder={t('Tab Name')}
                      onClick={e => e.stopPropagation()}
                      {...register(`${fieldname}.${tab._originalIndex}.label`)}
                    />
                  ) : (
                    <span className="text-sm font-bold">{tab.label || t('Tab')}</span>
                  )}
                  {!readOnly && !isVirtualTab && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(tab._originalIndex); }} className="ml-2 text-gray-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!readOnly && (
            <div className="px-4">
              <button 
                type="button" 
                onClick={() => handleAddTab(section._originalIndex >= 0 ? section._originalIndex : fieldsLength - 1)} 
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                {t('Add Tab')}
              </button>
            </div>
          )}
        </div>

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
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
