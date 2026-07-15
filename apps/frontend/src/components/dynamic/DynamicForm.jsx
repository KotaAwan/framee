import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Save, Trash2, History, Printer, FileDown, FileText } from 'lucide-react';
import apiClient from '../../lib/api.client';
import FormField from './FormField';
import VersionHistoryModal from './VersionHistoryModal';
import Breadcrumb from '../layout/Breadcrumb';
import Icon from '../ui/Icon';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm as useRHF } from 'react-hook-form';

export default function DynamicForm({ doctype, recordId, readOnly = false, isModal = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState(null);
  const [schema, setSchema] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSingle, setIsSingle] = useState(false);
  const [workflow, setWorkflow] = useState(null);
  const [showVersions, setShowVersions] = useState(false);

  const isNew = recordId === 'new';

  // 1. Build Zod Schema dynamically
  const zodSchema = useMemo(() => {
    const shape = {};
    schema.forEach(field => {
      let validator;
      if (['Data', 'Select', 'Link', 'Text', 'Password'].includes(field.fieldtype)) {
        validator = z.string();
        if (field.is_required) {
          validator = validator.min(1, `${field.label} is required`);
        } else {
          validator = validator.optional().or(z.literal('').or(z.null()));
        }
        
        // Specific fieldname rules
        if (field.fieldname === 'pin_hash' || field.fieldname === 'pin') {
          // If a pin is provided, it must be 6 digits
          validator = validator.refine(val => !val || /^\d{6}$/.test(val), {
            message: 'PIN must be exactly 6 digits'
          });
        }
      } else if (field.fieldtype === 'Check') {
        validator = z.boolean().optional();
      } else {
        // Fallback
        validator = z.any();
      }
      shape[field.fieldname] = validator;
    });
    return z.object(shape);
  }, [schema]);

  // 2. Initialize React Hook Form
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors }
  } = useRHF({
    resolver: schema.length > 0 ? zodResolver(zodSchema) : undefined,
    defaultValues: {}
  });

  // 3. Fetch Metadata and Data
  const loadForm = useCallback(async () => {
    if (!doctype) return;
    // Push state update to microtask queue
    await Promise.resolve();
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch metadata
      const metaRes = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
      const meta = metaRes.data?.data || {};
      setMeta(meta);
      const fields = meta.fields || [];
      setSchema(fields);
      setIsSingle(meta.is_single || false);

      // Initialize form with defaults or fetch existing record
      if (!isNew || meta.is_single) {
        const recordRes = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}`);
        if (recordRes.data.success) {
          const rowData = { ...recordRes.data.data };
          fields.forEach(f => {
            if (f.fieldtype === 'Check' && rowData[f.fieldname] !== undefined) {
              rowData[f.fieldname] = Boolean(rowData[f.fieldname]);
            }
          });
          reset(rowData);
        }
        // Fetch workflow transitions
        try {
          const wfRes = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}/workflow`);
          if (wfRes.data?.data?.available_transitions?.length > 0) {
            setWorkflow(wfRes.data.data);
          }
        } catch (e) {
          // Ignore if no workflow
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to load form configuration or data.');
    } finally {
      setLoading(false);
    }
  }, [doctype, recordId, isNew, reset]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);



  const [successMsg, setSuccessMsg] = useState('');

  // 4. Handle Submit
  const onSubmit = async (data) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (isNew) {
        await apiClient.post(`/api/v1/doc/${doctype}`, data);
      } else {
        await apiClient.put(`/api/v1/doc/${doctype}/${recordId}`, data);
      }
      setSuccessMsg(`Data berhasil disimpan! Mengalihkan dalam 3 detik...`);
      setTimeout(() => {
        router.push(`/doctype/${doctype}`);
      }, 3000);
    } catch (err) {
      console.error('Submit error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save record.');
      setSaving(false); // Only set to false on error, keep true during redirect
    }
  };

  const handleWorkflowTransition = async (actionKey, requireComment) => {
    let comment = '';
    if (requireComment) {
      comment = window.prompt("Please enter a comment for this action:");
      if (!comment) return; // cancelled
    }
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/workflow/transition`, {
        action_key: actionKey,
        comment
      });
      loadForm(); // reload everything
    } catch (err) {
      console.error('Workflow error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to execute workflow action.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    try {
      const res = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}/print`, { responseType: 'text' });
      const win = window.open('', '_blank');
      win.document.write(res.data);
      win.document.close();
      win.focus();
      // wait a tiny bit for resources to load if any
      setTimeout(() => win.print(), 500);
    } catch (err) {
      console.error('Print error:', err);
      setErrorMsg('Failed to load print format.');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${doctype}-${recordId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('PDF error:', err);
      setErrorMsg('Failed to download PDF.');
    }
  };

  // 5. Group Fields into Sections
  const sections = useMemo(() => {
    const grouped = { General: [] };
    schema.forEach(field => {
      // Ignore hidden fields for layout
      if (field.is_hidden) return;
      
      const secName = field.section || 'General';
      if (!grouped[secName]) {
        grouped[secName] = [];
      }
      grouped[secName].push(field);
    });
    return grouped;
  }, [schema]);

  // Helper to map 1-12 column width to Tailwind grid classes
  const getColSpanClass = (width) => {
    const colWidth = width || 12; // Default to full width
    switch (colWidth) {
      case 1: return 'md:col-span-1';
      case 2: return 'md:col-span-2';
      case 3: return 'md:col-span-3';
      case 4: return 'md:col-span-4';
      case 5: return 'md:col-span-5';
      case 6: return 'md:col-span-6';
      case 7: return 'md:col-span-7';
      case 8: return 'md:col-span-8';
      case 9: return 'md:col-span-9';
      case 10: return 'md:col-span-10';
      case 11: return 'md:col-span-11';
      case 12: default: return 'md:col-span-12';
    }
  };

  const formattedTitle = doctype ? doctype.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Header */}
      {!isModal && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            {!meta ? (
              <div className="flex items-center gap-3 w-48">
                 <div className="w-6 h-6 bg-(--color-border) rounded-full animate-pulse"></div>
                 <div className="h-6 bg-(--color-border) rounded-md flex-1 animate-pulse"></div>
              </div>
            ) : (
              <>
                <Icon name={meta?.icon || 'FileText'} size={24} className="text-(--color-primary)" fallback="FileText" />
                <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
                  {meta?.label || meta?.name || formattedTitle}
                </h1>
              </>
            )}
          </div>
          <div className="hidden sm:block">
            <Breadcrumb mode={isNew ? 'New' : 'Edit'} />
          </div>
        </div>
      )}

      {/* Toolbar (No Card) */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
          {workflow?.available_transitions?.map(t => (
            <button 
              key={t.action_key}
              onClick={() => handleWorkflowTransition(t.action_key, t.require_comment)}
              disabled={saving || loading}
              className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {t.action}
            </button>
          ))}
          {!isNew && !isSingle && (
            <>
              <button 
                type="button"
                onClick={() => setShowVersions(true)}
                className="flex items-center gap-1 bg-(--color-surface-hover) text-(--color-text) border border-(--color-border) px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <History size={16} /> Versions
              </button>
            </>
          )}
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={saving || loading}
            className="flex items-center gap-1 bg-(--color-primary) text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg shadow-sm font-medium animate-in fade-in zoom-in duration-300">
          {successMsg}
        </div>
      )}

      {/* Form Content */}
      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) p-12 text-center text-(--color-muted)">
            Loading form...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {Object.entries(sections).map(([sectionName, fields]) => (
              fields.length > 0 && (
                <div key={sectionName} className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden">
                  <div className="px-5 pt-4 pb-3 border-b border-(--color-border) bg-(--color-section-header-bg) flex items-center justify-between">
                    <h3 className="font-semibold text-(--color-text) text-base">{sectionName}</h3>
                    {(sectionName === 'General' || sectionName === 'Basic Details') && (
                      <span className="text-sm font-semibold text-(--color-text)">
                        ID : {isNew ? 'Auto' : recordId}
                      </span>
                    )}
                  </div>
                  <div className="px-5 pt-5 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4">
                      {fields.map(field => {
                        // Skip password fields in readOnly/modal mode
                        if (readOnly && field.fieldtype === 'Password') {
                          return null;
                        }
                        
                        // User request: hide password & pin in Edit and View, but keep in Add
                        if (doctype === 'sys_user' && !isNew && (field.fieldname.includes('password') || field.fieldname.includes('pin'))) {
                          return null;
                        }
                        return (
                        <div key={field.fieldname} className={`col-span-1 ${getColSpanClass(field.column_width)}`}>
                          <FormField 
                            field={field} 
                            register={register} 
                            control={control}
                            error={errors[field.fieldname]} 
                            readOnly={readOnly}
                          />
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            ))}
          </form>
        )}
      </div>

      {/* Reset Password Card for sys_user Edit */}
      {doctype === 'sys_user' && !isNew && !isModal && !readOnly && (
        <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden mt-6">
           <div className="px-5 py-4 border-b border-(--color-border) bg-(--color-section-header-bg)">
             <h3 className="font-semibold text-(--color-text) text-base">Security</h3>
           </div>
           <div className="px-5 py-6">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-sm">
                 <input 
                   type="password" 
                   id="new_password_input"
                   placeholder="New Password" 
                   className="flex-1 block w-full px-4 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) transition-all placeholder:text-(--color-input-placeholder)"
                 />
                 <button 
                   type="button" 
                   onClick={() => {
                      const pw = document.getElementById('new_password_input').value;
                      if (!pw) return alert('Password cannot be empty');
                      if (window.confirm('Are you sure you want to reset the password for this user?')) {
                        apiClient.post(`/api/v1/auth/reset-password/${recordId}`, { password: pw })
                          .then(() => {
                             alert('Password reset successfully');
                             document.getElementById('new_password_input').value = '';
                          })
                          .catch(e => alert(e.response?.data?.message || 'Failed to reset password'));
                      }
                   }}
                   className="bg-(--color-primary) text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-(--color-primary-hover) transition-colors whitespace-nowrap"
                 >
                   Save
                 </button>
             </div>
           </div>
        </div>
      )}

      {showVersions && (
        <VersionHistoryModal 
          doctype={doctype} 
          recordId={recordId} 
          onClose={() => {
            setShowVersions(false);
            loadForm(); // reload to get new data if restored
          }} 
        />
      )}
    </div>
  );
}

