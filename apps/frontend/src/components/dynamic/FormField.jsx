import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Controller } from 'react-hook-form';
import TableDocField from './TableDocField';
import apiClient from '../../lib/api.client';
import { useTranslation } from '@/hooks/useTranslation';

export default function FormField({ field, register, control, error, readOnly, autoCode }) {
  const { fieldname, label, fieldtype, is_required, options } = field;
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [linkOptions, setLinkOptions] = useState([]);

  useEffect(() => {
    if (fieldtype === 'Link' && options) {
      Promise.all([
        apiClient.get(`/api/v1/doc/${options}?limit=100`),
        apiClient.get(`/api/v1/meta/doctype/${options}`)
      ])
        .then(([docRes, metaRes]) => {
          if (docRes.data.success && metaRes.data.success) {
             const data = Array.isArray(docRes.data.data) ? docRes.data.data : (docRes.data.data.records || []);
             const meta = metaRes.data.data;
             const searchField = meta.fields.find(f => f.in_search);
             const searchFieldName = searchField ? searchField.fieldname : null;

             setLinkOptions(data.map(d => ({ 
               value: d.id, 
               label: searchFieldName && d[searchFieldName] ? d[searchFieldName] : (d.name || d.full_name || d.title || d.code || d.id) 
             })));
          }
        })
        .catch(err => console.error('Failed to fetch link options', err));
    }
  }, [fieldtype, options]);

  // If it's a Table field, render the subgrid directly
  if (fieldtype === 'Table') {
    return (
      <TableDocField
        fieldname={fieldname}
        label={label}
        options={options}
        control={control}
        register={register}
        error={error}
        readOnly={readOnly}
      />
    );
  }

  // Base input class using CSS variables (theme-aware)
  const baseInput = [
    'w-full px-3 py-2 text-sm rounded-md border transition-colors',
    'bg-(--color-input-bg) text-(--color-input-text)',
    'border-(--color-input-border)',
    'placeholder:text-(--color-input-placeholder)',
    'focus:outline-none focus:border-(--color-input-focus-border)',
    error ? 'border-red-500' : '',
    readOnly ? 'opacity-70 cursor-not-allowed' : '',
  ].join(' ');

  const renderInput = () => {
    switch (fieldtype) {
      case 'Data':
      case 'Int':
      case 'Float':
        const resolvedPlaceholder = (fieldname === 'code' && autoCode) ? autoCode : `${t('Enter', 'Enter')} ${t(label, label)}`;
        return (
          <input
            type={fieldtype === 'Data' ? 'text' : 'number'}
            {...register(fieldname)}
            className={baseInput}
            placeholder={resolvedPlaceholder}
            disabled={readOnly}
          />
        );

      case 'Password':
        return (
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register(fieldname, {
                onChange: (e) => {
                  if (fieldname === 'pin_hash' || fieldname === 'pin') {
                    e.target.value = e.target.value.replace(/\D/g, '');
                  }
                }
              })}
              maxLength={fieldname === 'pin_hash' || fieldname === 'pin' ? 6 : undefined}
              inputMode={fieldname === 'pin_hash' || fieldname === 'pin' ? 'numeric' : undefined}
              className={`${baseInput} pr-10`}
              placeholder={`${t('Enter', 'Enter')} ${t(label, label)}`}
              disabled={readOnly}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted) hover:text-(--color-text) focus:outline-none"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        );

      case 'Text':
        return (
          <textarea
            {...register(fieldname)}
            rows={4}
            className={baseInput}
            placeholder={`${t('Enter', 'Enter')} ${t(label, label)}`}
            disabled={readOnly}
          />
        );

      case 'Select':
        return (
          <div className="relative">
            <select
              {...register(fieldname)}
              className={`${baseInput} appearance-none pr-8`}
              disabled={readOnly}
            >
              <option value="">{t('Select', 'Select')} {t(label, label)}...</option>
              {options && (Array.isArray(options) ? options : options.split('\n')).map(opt => {
                const optStr = typeof opt === 'string' ? opt.trim() : opt;
                if (!optStr) return null;
                return <option key={optStr} value={optStr}>{t(optStr, optStr)}</option>
              })}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-(--color-muted)">
              <ChevronDown size={16} />
            </div>
          </div>
        );

      case 'Link':
        return (
          <div className="relative">
            <Controller
              name={fieldname}
              control={control}
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    // If it is numeric (like language_id which is integer id), convert it to number.
                    // Otherwise keep as string (or empty string).
                    if (val === '') {
                      onChange(null);
                    } else if (/^\d+$/.test(val)) {
                      onChange(Number(val));
                    } else {
                      onChange(val);
                    }
                  }}
                  onBlur={onBlur}
                  value={value !== undefined && value !== null ? value : ''}
                  ref={ref}
                  className={`${baseInput} appearance-none pr-8`}
                  disabled={readOnly}
                >
                  <option value="">{t('Select', 'Select')} {t(label, label)}...</option>
                  {linkOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.label, opt.label)}</option>
                  ))}
                </select>
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-(--color-muted)">
              <ChevronDown size={16} />
            </div>
          </div>
        );

      case 'Check':
        return (
          <div className="flex items-center mt-2">
            <input
              type="checkbox"
              {...register(fieldname)}
              className="w-4 h-4 rounded border-(--color-input-border) bg-(--color-input-bg) text-(--color-primary) focus:ring-(--color-primary) disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={readOnly}
            />
            <span className="ml-2 text-sm text-(--color-text) cursor-pointer" onClick={(e) => {
                if (!readOnly) {
                   const checkbox = e.currentTarget.previousSibling;
                   checkbox.click();
                }
            }}>{t(label, label)}</span>
          </div>
        );

      default:
        return (
          <input
            type="text"
            {...register(fieldname)}
            className={baseInput}
            placeholder={`${t('Enter', 'Enter')} ${t(label, label)}`}
            disabled={readOnly}
          />
        );
    }
  };

  return (
    <div className="flex flex-col">
      {fieldtype !== 'Check' && (
        <label className="mb-1 text-sm font-medium text-(--color-text)">
          {t(label, label)} {is_required ? <span className="text-red-500">*</span> : ''}
        </label>
      )}

      {renderInput()}

      {error && (
        <span className="mt-1 text-xs text-red-500">
          {error.message}
        </span>
      )}
    </div>
  );
}
