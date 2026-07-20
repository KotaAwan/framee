import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Filter, Columns, MoreVertical, Upload, Download, Settings } from 'lucide-react';
import DataTable from './DataTable';
import ActivityTimeline from './ActivityTimeline';
import apiClient from '../../lib/api.client';
import { useRouter } from 'next/router';
import Breadcrumb from '../layout/Breadcrumb';
import Icon from '../ui/Icon';

export default function DynamicList({ doctype, module }) {
  const router = useRouter();
  
  // State for data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for pagination & search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [rowSelection, setRowSelection] = useState({});
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!doctype) return;
    const fetchMeta = async () => {
      try {
        const res = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
        if (res.data.success) {
          setMeta(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load doctype meta', err);
      }
    };
    fetchMeta();
  }, [doctype]);

  const [refreshActivity, setRefreshActivity] = useState(0);

  const fetchData = React.useCallback(async () => {
    // Push state update to microtask queue to avoid synchronous setState in effect
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/doc/${doctype}`, {
        params: { page, pageSize, search }
      });
      
      if (res.data.success) {
        const results = Array.isArray(res.data.data) ? res.data.data : (res.data.data.records || []);
        setData(results);
        setTotalRecords(res.data.data.total || results.length);
      }
      setRefreshActivity(prev => prev + 1);
    } catch (err) {
      console.error('Failed to fetch list data', err);
    } finally {
      setLoading(false);
    }
  }, [doctype, page, pageSize, search]);

  useEffect(() => {
    // eslint-disable-next-line
    fetchData();
  }, [fetchData]);

  const columns = useMemo(() => {
    if (!meta || !meta.fields) return [];
    return meta.fields
      .filter(f => f.in_list)
      .filter(f => !(doctype === 'sys_user' && ['password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash'].includes(f.fieldname)))
      .sort((a, b) => (a.list_view_seq || 99) - (b.list_view_seq || 99))
      .map(f => ({
        id: f.fieldname,
        header: f.label,
        accessorKey: f.fieldname,
        type: f.fieldtype
      }));
    // eslint-disable-next-line
  }, [meta]);

  const formattedTitle = meta?.label || meta?.name || doctype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const headerIcon = meta?.icon || 'Database';

  const handleExport = async (format) => {
    try {
      const res = await apiClient.get(`/api/v1/doc/${doctype}/export`, {
        params: { format, search },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${doctype}_export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export data');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post(`/api/v1/doc/${doctype}/import`, formData);
      if (res.data.success) {
        alert(`Successfully imported ${res.data.imported} records.`);
        fetchData();
      }
    } catch (err) {
      console.error('Import failed', err);
      alert(err.response?.data?.message || 'Failed to import data');
    }
    e.target.value = null; // reset
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          {!meta ? (
            <div className="flex items-center gap-3 w-48">
               <div className="w-6 h-6 bg-(--color-border) rounded-full animate-pulse"></div>
               <div className="h-6 bg-(--color-border) rounded-md flex-1 animate-pulse"></div>
            </div>
          ) : (
            <>
              <Icon name={headerIcon} size={24} className="text-(--color-primary)" fallback="Database" />
              <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">{formattedTitle}</h1>
            </>
          )}
        </div>
        
        <div className="hidden sm:block">
          <Breadcrumb />
        </div>
      </div>

      <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden flex flex-col">
        {/* Toolbar Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b border-(--color-border)">
        
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-muted)" size={16} />
            <input 
              type="text" 
              placeholder={`Search ${formattedTitle}...`}
              className="w-full pl-9 pr-4 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) transition-all placeholder:text-(--color-input-placeholder)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
          </div>
          
          {/* Module filter placeholder based on screenshot */}
          <select className="hidden sm:block border border-(--color-input-border) bg-(--color-input-bg) text-(--color-input-text) rounded-md text-sm py-2 px-3 focus:outline-none focus:border-(--color-primary)">
            <option>All Modules</option>
          </select>
          
          <input 
              type="text" 
              placeholder="Filter Slug..."
              className="hidden sm:block pl-3 pr-4 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) placeholder:text-(--color-input-placeholder)"
          />
        </div>

        <div className="flex items-center gap-2">
          {Object.keys(rowSelection).length > 0 && (
            <div className="relative group">
              <button className="flex items-center gap-1 p-2 border border-(--color-border) rounded-md hover:bg-(--color-surface-hover) text-sm font-medium text-(--color-text) bg-(--color-input-bg) shadow-sm transition-colors">
                Bulk Action
              </button>
              <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-10 w-40">
                <div className="bg-(--color-surface) shadow-lg border border-(--color-border) rounded-md py-1">
                   <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                     Print Selected
                   </button>
                   <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600">
                     Delete Selected
                   </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Actions Dropdown */}
          <div className="relative group">
            <button className="p-2 border border-(--color-border) rounded-md hover:bg-(--color-surface-hover) text-(--color-muted) transition-colors bg-(--color-input-bg)">
              <MoreVertical size={18} />
            </button>
            <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-10 w-48">
              <div className="bg-(--color-surface) shadow-lg border border-(--color-border) rounded-md py-1">
                 <button onClick={() => document.getElementById('import-csv').click()} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                   <Upload size={14} /> Import CSV
                 </button>
                 <input 
                    type="file" 
                    id="import-csv" 
                    className="hidden" 
                    accept=".csv"
                    onChange={handleImport}
                  />
                 <button onClick={() => handleExport('csv')} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                   <Download size={14} /> Export CSV
                 </button>
                 <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                   <Download size={14} /> Export XLSX
                 </button>
                 <div className="border-t border-(--color-border) my-1"></div>
                 <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                   <Columns size={14} /> Fields View
                 </button>
                 <button className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                   <Settings size={14} /> Fields Filter
                 </button>
              </div>
            </div>
          </div>
          
          <button 
            className="flex items-center justify-center bg-(--color-primary) text-white w-9 h-9 rounded-md hover:bg-(--color-primary-hover) transition-colors"
            onClick={() => router.push(`/${module || 'doctype'}/${doctype}/new`)}
            title="Create New"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-(--color-surface) shadow-sm border border-(--color-border) rounded-lg overflow-hidden">
        <DataTable 
          data={data} 
          columns={columns} 
          loading={loading}
          doctype={doctype}
          module={module}
          page={page}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          refreshData={fetchData}
        />
      </div>
    </div>

      {/* Activity Timeline */}
      <ActivityTimeline doctype={doctype} refreshTrigger={refreshActivity} />
    </div>
  );
}
