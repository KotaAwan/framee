import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  FileText, 
  Save, 
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { docApi } from '@/lib/doc-api';

export default function DynamicForm() {
  const router = useRouter();
  const { module, doctype, id } = router.query;
  const isNew = id === 'new';
  
  const [formData, setFormData] = useState({ name: '' });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const formattedTitle = doctype 
    ? doctype.toString().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Loading...';

  useEffect(() => {
    if (!doctype || isNew) return;
    
    const fetchRecord = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await docApi.get(doctype, id);
        if (res.success && res.data) {
          setFormData(res.data);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (err) {
        console.error('Error fetching record:', err);
        setError(err.response?.data?.error || err.message || 'Failed to fetch document');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecord();
  }, [doctype, id, isNew]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!doctype) return;
    
    setIsSaving(true);
    setError(null);
    try {
      let res;
      if (isNew) {
        res = await docApi.create(doctype, formData);
        if (res.success && res.data) {
          // Redirect to the newly created document
          router.replace(`/${module}/${doctype}/${res.data.id || res.data.name}`);
        }
      } else {
        res = await docApi.update(doctype, id, formData);
        if (res.success && res.data) {
          setFormData(res.data);
          // show a brief success toast here in real app
        }
      }
    } catch (err) {
      console.error('Error saving record:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // For now, auto-generate fields based on current formData keys, 
  // or default to Name if new
  const fields = Object.keys(formData).filter(k => !['tenant_id', 'created_at', 'updated_at', 'id'].includes(k));
  if (fields.length === 0) fields.push('name');

  return (
    <>
      <Head>
        <title>{isNew ? `New ${formattedTitle}` : `${formData.name || id} - ${formattedTitle}`} | Framee</title>
      </Head>

      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push(`/${module}/${doctype}`)}
              className="mr-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-500">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {isNew ? `New ${formattedTitle}` : formData.name || id}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formattedTitle} Document
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSave}
              disabled={isLoading || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Dynamic Form Content */}
        <Card className="p-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
              <p>Loading document...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map(field => (
                <div key={field} className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <Input
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}...`}
                    disabled={field === 'status'} // Prevent editing status directly for now
                  />
                </div>
              ))}
              
              {/* Optional: Add extra field for new records just in case */}
              {isNew && !fields.includes('status') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <Input
                    value={formData.status || 'Draft'}
                    disabled
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
