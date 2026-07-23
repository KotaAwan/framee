import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Plus, Search, Filter, Columns, MoreVertical, Upload, Download, Settings } from 'lucide-react';
import DataTable from './DataTable';
import ActivityTimeline from './ActivityTimeline';
import apiClient from '../../lib/api.client';
import { useRouter } from 'next/router';
import Breadcrumb from '../layout/Breadcrumb';
import Icon from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '@/hooks/useTranslation';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function DynamicList({ doctype, module }) {
  const router = useRouter();
  const { t } = useTranslation();

  // State for data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for pagination & search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [rowSelection, setRowSelection] = useState({});
  const [meta, setMeta] = useState(null);
  const [permissions, setPermissions] = useState(null);

  // Column Visibility States
  const [visibleColumns, setVisibleColumns] = useState({});
  const [tempVisibleColumns, setTempVisibleColumns] = useState({});
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Filter Configuration States (Fields Filter Modal)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterFieldsConfig, setFilterFieldsConfig] = useState({});
  const [tempFilterFieldsConfig, setTempFilterFieldsConfig] = useState({});

  // Actions dropdown menu
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);

  // Bulk Actions State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ success: 0, failed: 0, total: 0 });
  const [recordsToDelete, setRecordsToDelete] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Close actions menu when clicking outside

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Active Filter Badges & Input values
  const [activeFilters, setActiveFilters] = useState([]);
  const debouncedActiveFilters = useDebounce(activeFilters, 500);
  // Form input values for dynamic filters (one state per active filter field)
  const [filterInputValues, setFilterInputValues] = useState({});
  // Options cache for Link fields in the filters
  const [linkFieldsOptions, setLinkFieldsOptions] = useState({});

  useEffect(() => {
    // Reset state when doctype changes
    setRowSelection({});
    setPage(1);
    setSearch('');
    setActiveFilters([]);
    setFilterInputValues({});
  }, [doctype]);

  useEffect(() => {
    if (!doctype) return;
    const fetchMeta = async () => {
      try {
        const [res, permRes] = await Promise.all([
          apiClient.get(`/api/v1/meta/doctype/${doctype}`),
          apiClient.get(`/api/v1/auth/permissions/${doctype}`)
        ]);

        if (permRes.data.success) {
          setPermissions(permRes.data.data);
        }

        if (res.data.success) {
          const metaData = res.data.data;
          setMeta(metaData);

          // Set default visible columns based strictly on f.in_list
          const initialVisible = {};
          // Check if 'id' field is present in backend docfields and has in_list === 1
          const idField = (metaData.fields || []).find(f => f.fieldname === 'id');
          initialVisible['id'] = idField ? (idField.in_list === 1 || idField.in_list === true) : true;

          (metaData.fields || []).forEach(f => {
            if (f.fieldname !== 'id') {
              initialVisible[f.fieldname] = (f.in_list === 1 || f.in_list === true);
            }
          });
          setVisibleColumns(initialVisible);

          // Populate filter configurations based on f.in_filter
          const initialFilters = {};
          (metaData.fields || []).forEach(f => {
            initialFilters[f.fieldname] = (f.in_filter === 1 || f.in_filter === true);
          });
          setFilterFieldsConfig(initialFilters);

          // Load Options for any filter field of type 'Link'
          const linkFields = (metaData.fields || []).filter(f => f.fieldtype === 'Link' && f.options);
          linkFields.forEach(async (field) => {
            const targetDoctype = Array.isArray(field.options) ? field.options[0] : field.options;
            try {
              const [docRes, metaRes] = await Promise.all([
                apiClient.get(`/api/v1/doc/${targetDoctype}?limit=100`),
                apiClient.get(`/api/v1/meta/doctype/${targetDoctype}`)
              ]);
              if (docRes.data.success && metaRes.data.success) {
                const recordsData = Array.isArray(docRes.data.data) ? docRes.data.data : (docRes.data.data.records || []);
                const targetMeta = metaRes.data.data;
                const searchField = targetMeta.fields.find(tf => tf.in_search);
                const searchFieldName = searchField ? searchField.fieldname : null;

                const optionsList = recordsData.map(d => ({
                  value: d.id,
                  label: searchFieldName && d[searchFieldName] ? d[searchFieldName] : (d.name || d.full_name || d.title || d.code || d.id)
                }));
                setLinkFieldsOptions(prev => ({
                  ...prev,
                  [field.fieldname]: optionsList
                }));
              }
            } catch (err) {
              console.error(`Failed to load options for link field ${field.fieldname}`, err);
            }
          });
        }
      } catch (err) {
        console.error('Failed to load doctype meta', err);
      }
    };
    fetchMeta();
  }, [doctype]);

  const [refreshActivity, setRefreshActivity] = useState(0);

  const fetchData = React.useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const filterParams = {};
      debouncedActiveFilters.forEach(f => {
        filterParams[f.field] = f.value;
      });

      const order_by = sortConfig.key ? `${sortConfig.key} ${sortConfig.direction}` : undefined;

      const res = await apiClient.get(`/api/v1/doc/${doctype}`, {
        params: { page, pageSize, search: debouncedSearch, order_by, ...filterParams }
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
  }, [doctype, page, pageSize, debouncedSearch, debouncedActiveFilters, sortConfig]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const columns = useMemo(() => {
    if (!meta || !meta.fields) return [];
    const dynamicCols = meta.fields
      .filter(f => f.in_list && visibleColumns[f.fieldname] !== false)
      .filter(f => !['id', 'password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash'].includes(f.fieldname))
      .sort((a, b) => (a.list_view_seq || 99) - (b.list_view_seq || 99))
      .map(f => ({
        id: f.fieldname,
        header: t(f.label, f.label),
        accessorKey: f.fieldname,
        type: f.fieldtype
      }));

    // Prepend ID column if checked/visible
    if (visibleColumns['id'] !== false) {
      dynamicCols.unshift({
        id: 'id',
        header: t('ID', 'ID'),
        accessorKey: 'id',
        type: 'Data'
      });
    }

    return dynamicCols;
  }, [meta, visibleColumns, t]);

  const rawTitle = meta?.label || meta?.name || doctype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const formattedTitle = t(rawTitle, rawTitle);
  const headerIcon = meta?.icon || 'Database';

  const handleExport = async (format) => {
    try {
      const filterParams = {};
      activeFilters.forEach(f => {
        filterParams[f.field] = f.value;
      });

      // Build Query String
      const paramsObj = { format, search, ...filterParams };
      const queryString = new URLSearchParams(paramsObj).toString();
      const urlEndpoint = `${apiClient.defaults.baseURL || 'http://localhost:3001'}/api/v1/doc/${doctype}/export?${queryString}`;

      // Get Bearer Token directly from auth store
      const { accessToken } = useAuthStore.getState();

      // Use native fetch to download raw blob correctly, preventing Axios binary string corruption
      const response = await fetch(urlEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        }
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const blobData = await response.blob();
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${doctype}_export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setSuccessMsg(t(`Exporting ${format.toUpperCase()}...`, `Exporting ${format.toUpperCase()}...`));
    } catch (err) {
      console.error('Export error:', err);
      setErrorMsg(t(`Failed to export ${format.toUpperCase()}`, `Failed to export ${format.toUpperCase()}`));
    }
  };

  // --- Bulk Action Handlers ---
  const handleBulkPrint = () => {
    const selectedRecords = Object.keys(rowSelection).map(idx => data[idx]).filter(Boolean);
    if (selectedRecords.length === 0) return;

    if (selectedRecords.length > 5) {
      if (!window.confirm(t('You are trying to print more than 5 records. This will open multiple tabs. Continue?', 'You are trying to print more than 5 records. This will open multiple tabs. Continue?'))) {
        return;
      }
    }

    const { accessToken } = useAuthStore.getState();
    const baseUrl = apiClient.defaults.baseURL || 'http://localhost:3001';

    selectedRecords.forEach(record => {
      const printUrl = `${baseUrl}/api/v1/doc/${doctype}/${record.id}/print?access_token=${accessToken}`;
      window.open(printUrl, '_blank');
    });

    // Clear selection after printing
    setRowSelection({});
  };

  const handleBulkDeleteRequest = () => {
    const selectedRecords = Object.keys(rowSelection).map(idx => data[idx]).filter(Boolean);
    if (selectedRecords.length === 0) return;

    // Validation: prevent deleting submitted or cancelled records
    const invalidRecords = selectedRecords.filter(r =>
      r.status?.toUpperCase() === 'SUBMITTED' || r.status?.toUpperCase() === 'CANCELLED'
    );

    if (invalidRecords.length > 0) {
      setErrorMsg(t('Cannot delete Submitted or Cancelled records.', 'Cannot delete Submitted or Cancelled records.'));
      return;
    }

    setRecordsToDelete(selectedRecords);
    setIsBulkDeleteModalOpen(true);
  };

  const executeBulkDelete = async () => {
    setBulkDeleting(true);
    let successCount = 0;
    let failedCount = 0;

    setBulkDeleteProgress({ success: 0, failed: 0, total: recordsToDelete.length });

    for (const record of recordsToDelete) {
      try {
        await apiClient.delete(`/api/v1/doc/${doctype}/${record.id}`, { data: { delete_reason: 'Bulk Delete' } });
        successCount++;
      } catch (err) {
        console.error(`Failed to delete record ${record.id}:`, err);
        failedCount++;
      }
      setBulkDeleteProgress(prev => ({ ...prev, success: successCount, failed: failedCount }));
    }

    setBulkDeleting(false);
    setIsBulkDeleteModalOpen(false);
    setRowSelection({});

    if (failedCount === 0) {
      setSuccessMsg(`${t('Successfully deleted', 'Successfully deleted')} ${successCount} ${t('records.', 'records.')}`);
    } else {
      setErrorMsg(`${t('Deleted', 'Deleted')} ${successCount} ${t('records, but', 'records, but')} ${failedCount} ${t('failed.', 'failed.')}`);
    }

    fetchData();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post(`/api/v1/doc/${doctype}/import`, formData);
      if (res.data.success) {
        setSuccessMsg(`Successfully imported ${res.data.imported} records.`);
        fetchData();
      }
    } catch (err) {
      console.error('Import failed', err);
      setErrorMsg(err.response?.data?.message || 'Failed to import data');
    }
    e.target.value = null; // reset
  };

  // Toggle Visibility for a Field Column (Temp State)
  const toggleTempColumnVisibility = (fieldname) => {
    setTempVisibleColumns(prev => ({
      ...prev,
      [fieldname]: !prev[fieldname]
    }));
  };

  // Open Fields View Modal (Copy actual state to temp state)
  const openFieldsViewModal = () => {
    setTempVisibleColumns({ ...visibleColumns });
    setIsViewModalOpen(true);
  };

  // Save Fields View configuration (Apply temp state to actual state & save in Database)
  const saveFieldsView = async () => {
    try {
      const visibilityPayload = {};
      if (meta && meta.fields) {
        meta.fields.forEach(f => {
          if (!['password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname)) {
            visibilityPayload[f.fieldname] = tempVisibleColumns[f.fieldname] !== false;
          }
        });
      }

      const res = await apiClient.put(`/api/v1/meta/doctype/${doctype}/fields-visibility`, {
        visibility: visibilityPayload
      });

      if (res.data.success) {
        setVisibleColumns({ ...tempVisibleColumns });
        setIsViewModalOpen(false);
        const metaRes = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
        if (metaRes.data.success) {
          setMeta(metaRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to save fields visibility to DB', err);
      setErrorMsg('Failed to save layout changes to database.');
    }
  };

  // Get active fields shown in List (for Fields Filter selection modal)
  const fieldsActiveInList = useMemo(() => {
    if (!meta || !meta.fields) return [];
    return meta.fields
      .filter(f => f.fieldtype !== 'Table')
      .filter(f => visibleColumns[f.fieldname] !== false)
      .filter(f => !['password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname));
  }, [meta, visibleColumns]);

  // Open Fields Filter Modal
  const openFieldsFilterModal = () => {
    setTempFilterFieldsConfig({ ...filterFieldsConfig });
    setIsFilterModalOpen(true);
  };

  // Save Fields Filter configurations
  const saveFieldsFilterConfig = async () => {
    try {
      const filterPayload = {};
      fieldsActiveInList.forEach(f => {
        filterPayload[f.fieldname] = tempFilterFieldsConfig[f.fieldname] === true;
      });

      const res = await apiClient.put(`/api/v1/meta/doctype/${doctype}/fields-filter-config`, {
        filters: filterPayload
      });

      if (res.data.success) {
        setFilterFieldsConfig({ ...tempFilterFieldsConfig });
        setIsFilterModalOpen(false);
        const metaRes = await apiClient.get(`/api/v1/meta/doctype/${doctype}`);
        if (metaRes.data.success) {
          setMeta(metaRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to save filter settings to DB', err);
      setErrorMsg('Failed to save filter configuration to database.');
    }
  };

  // Toggle filter checkbox temp state
  const toggleTempFilterConfig = (fieldname) => {
    setTempFilterFieldsConfig(prev => ({
      ...prev,
      [fieldname]: !prev[fieldname]
    }));
  };

  // Check if all active in-list fields are selected as filterable
  const isAllFiltersChecked = useMemo(() => {
    if (fieldsActiveInList.length === 0) return false;
    return fieldsActiveInList.every(f => tempFilterFieldsConfig[f.fieldname] === true);
  }, [fieldsActiveInList, tempFilterFieldsConfig]);

  // Select all / Deselect all filters toggle
  const handleSelectAllFiltersToggle = () => {
    const nextState = !isAllFiltersChecked;
    const nextObj = { ...tempFilterFieldsConfig };
    fieldsActiveInList.forEach(f => {
      nextObj[f.fieldname] = nextState;
    });
    setTempFilterFieldsConfig(nextObj);
  };

  // Check if all fields are checked/selected in temp config (Fields View Modal)
  const isAllChecked = useMemo(() => {
    if (!meta) return false;
    const targets = ['id', ...meta.fields
      .filter(f => f.fieldtype !== 'Table')
      .filter(f => !['id', 'password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname))
      .map(f => f.fieldname)
    ];
    return targets.every(name => tempVisibleColumns[name] !== false);
  }, [meta, tempVisibleColumns]);

  // Handle Select All toggle (Fields View Modal)
  const handleSelectAllToggle = () => {
    if (!meta) return;
    const targets = ['id', ...meta.fields
      .filter(f => f.fieldtype !== 'Table')
      .filter(f => !['id', 'password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname))
      .map(f => f.fieldname)
    ];

    const nextState = !isAllChecked;
    const nextObj = { ...tempVisibleColumns };
    targets.forEach(name => {
      nextObj[name] = nextState;
    });
    setTempVisibleColumns(nextObj);
  };

  // Get active filters that should be rendered on search bar (strictly in_filter === 1 and shown in visibleColumns)
  const activeSearchFilters = useMemo(() => {
    if (!meta || !meta.fields) return [];
    return meta.fields
      .filter(f => f.fieldtype !== 'Table')
      .filter(f => visibleColumns[f.fieldname] !== false)
      .filter(f => filterFieldsConfig[f.fieldname] === true)
      .filter(f => !['password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname));
  }, [meta, visibleColumns, filterFieldsConfig]);

  // Handle value change for a search bar filter input
  const handleFilterInputChange = (fieldname, value) => {
    setFilterInputValues(prev => ({
      ...prev,
      [fieldname]: value
    }));

    // Update active filters dynamically
    setActiveFilters(prev => {
      const filtered = prev.filter(f => f.field !== fieldname);
      if (value !== '' && value !== null) {
        const fieldMeta = meta.fields.find(f => f.fieldname === fieldname);
        let displayValue = value;
        if (fieldMeta?.fieldtype === 'Check') {
          displayValue = value === '1' ? 'Yes' : 'No';
        } else if (fieldMeta?.fieldtype === 'Link' && linkFieldsOptions[fieldname]) {
          const matchedOpt = linkFieldsOptions[fieldname].find(o => String(o.value) === String(value));
          if (matchedOpt) displayValue = matchedOpt.label;
        }
        return [...filtered, { field: fieldname, label: fieldMeta?.label || fieldname, value, displayValue }];
      }
      return filtered;
    });
  };

  // Remove a Filter Condition
  const removeFilter = (index) => {
    const filterItem = activeFilters[index];
    if (filterItem) {
      setFilterInputValues(prev => ({
        ...prev,
        [filterItem.field]: ''
      }));
    }
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAllFilters = () => {
    setFilterInputValues({});
    setActiveFilters([]);
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

      {errorMsg && (
        <div className="bg-red-50/50 dark:bg-red-900/10 border-l-4 border-red-500 p-3 rounded-r-md flex justify-between items-start shadow-sm ring-1 ring-red-500/20 my-2">
          <div className="flex gap-3">
            <Icon name="AlertTriangle" size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-(--color-text) text-sm font-medium whitespace-pre-line">
              {errorMsg}
            </div>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700 dark:hover:text-red-300 ml-3 shrink-0 transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50/50 dark:bg-green-900/10 border-l-4 border-green-500 p-3 rounded-r-md flex justify-between items-start shadow-sm ring-1 ring-green-500/20 my-2">
          <div className="flex gap-3">
            <Icon name="CheckCircle2" size={18} className="text-green-500 mt-0.5 shrink-0" />
            <div className="text-(--color-text) text-sm font-medium whitespace-pre-line">
              {successMsg}
            </div>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700 dark:hover:text-green-300 ml-3 shrink-0 transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* Active Filter Badges */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-semibold text-(--color-muted) flex items-center gap-1">
            <Filter size={12} /> Active Filters:
          </span>
          {activeFilters.map((f, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-(--color-surface-hover) border border-(--color-border) px-2 py-0.5 rounded-full text-xs">
              <span className="font-medium text-(--color-text)">{f.label}:</span>
              <span className="text-(--color-muted)">{f.displayValue || f.value || 'Empty'}</span>
              <button
                onClick={() => removeFilter(idx)}
                className="text-red-500 hover:text-red-700 ml-1 font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            onClick={handleClearAllFilters}
            className="text-xs text-red-500 hover:underline font-medium"
          >
            Clear All
          </button>
        </div>
      )}

      <div className="bg-(--color-surface) rounded-lg shadow-sm border border-(--color-border) overflow-hidden flex flex-col">
        {/* Toolbar Area */}
        <div className="flex flex-wrap justify-between items-center gap-4 p-4 border-b border-(--color-border)">

          <div className="flex flex-wrap items-center gap-3 flex-1 w-full sm:w-auto">

            {/* Dynamic Filter Inputs matching in_filter === 1 (with exact width w-40 to keep them unified) */}
            {activeSearchFilters.map(f => {
              const inputVal = filterInputValues[f.fieldname] || '';

              // 1. Link FieldType Select Box
              if (f.fieldtype === 'Link') {
                const opts = linkFieldsOptions[f.fieldname] || [];
                return (
                  <div key={f.fieldname} className="w-40 relative">
                    <select
                      value={inputVal}
                      onChange={(e) => handleFilterInputChange(f.fieldname, e.target.value)}
                      className="w-full px-3 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) appearance-none pr-8"
                    >
                      <option value="">{t('search', 'Search')} {t(f.label, f.label)}...</option>
                      {opts.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-(--color-muted)">
                      <Filter size={12} />
                    </div>
                  </div>
                );
              }

              // 2. Check FieldType Select Box (Yes / No)
              if (f.fieldtype === 'Check') {
                return (
                  <div key={f.fieldname} className="w-40 relative">
                    <select
                      value={inputVal}
                      onChange={(e) => handleFilterInputChange(f.fieldname, e.target.value)}
                      className="w-full px-3 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) appearance-none pr-8"
                    >
                      <option value="">{t('search', 'Search')} {t(f.label, f.label)}...</option>
                      <option value="1">{t('yes', 'Yes')}</option>
                      <option value="0">{t('no', 'No')}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-(--color-muted)">
                      <Filter size={12} />
                    </div>
                  </div>
                );
              }

              // 3. Standard Text / Data Input Field
              return (
                <input
                  key={f.fieldname}
                  type="text"
                  placeholder={`${t('search', 'Search')} ${t(f.label, f.label)}...`}
                  value={inputVal}
                  onChange={(e) => handleFilterInputChange(f.fieldname, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                  className="w-40 px-3 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-md text-sm focus:outline-none focus:border-(--color-primary) placeholder:text-(--color-input-placeholder)"
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(rowSelection).length > 0 && (
              <div className="relative group">
                <button className="flex items-center gap-1 p-2 border border-(--color-border) rounded-md hover:bg-(--color-surface-hover) text-sm font-medium text-(--color-text) bg-(--color-input-bg) shadow-sm transition-colors">
                  {t('Bulk Action', 'Bulk Action')}
                </button>
                <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-10 w-40">
                  <div className="bg-(--color-surface) shadow-lg border border-(--color-border) rounded-md py-1">
                    {permissions?.print && (
                      <button onClick={handleBulkPrint} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                        {t('Print Selected', 'Print Selected')}
                      </button>
                    )}
                    {permissions?.delete && (
                      <button onClick={handleBulkDeleteRequest} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600">
                        {t('Delete Selected', 'Delete Selected')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions Dropdown */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setIsActionsMenuOpen(prev => !prev)}
                className="p-2 border border-(--color-border) rounded-md hover:bg-(--color-surface-hover) text-(--color-muted) transition-colors bg-(--color-input-bg)"
              >
                <MoreVertical size={18} />
              </button>
              {isActionsMenuOpen && (
                <div className="absolute right-0 top-full pt-1 z-10 w-48">
                  <div className="bg-(--color-surface) shadow-lg border border-(--color-border) rounded-md py-1">
                    <button
                      onClick={() => { document.getElementById('import-csv').click(); setIsActionsMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text) disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!permissions?.import}
                    >
                      <Upload size={14} /> {t('Import CSV', 'Import CSV')}
                    </button>
                    <input
                      type="file"
                      id="import-csv"
                      className="hidden"
                      accept=".csv"
                      onChange={handleImport}
                    />
                    <div className="border-t border-(--color-border) my-1"></div>
                    <button
                      onClick={() => { setIsActionsMenuOpen(false); handleExport('xlsx'); }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text) disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!permissions?.export}
                    >
                      <Download size={14} /> {t('Export XLSX', 'Export XLSX')}
                    </button>
                    <button
                      onClick={() => { setIsActionsMenuOpen(false); handleExport('pdf'); }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text) disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!permissions?.export}
                    >
                      <Download size={14} /> {t('Export PDF', 'Export PDF')}
                    </button>
                    <div className="border-t border-(--color-border) my-1"></div>
                    <button onClick={() => { openFieldsViewModal(); setIsActionsMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                      <Columns size={14} /> {t('Fields View', 'Fields View')}
                    </button>
                    <button onClick={() => { openFieldsFilterModal(); setIsActionsMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-(--color-surface-hover) text-sm text-(--color-text)">
                      <Settings size={14} /> {t('Fields Filter', 'Fields Filter')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className="flex items-center justify-center bg-(--color-primary) text-white w-9 h-9 rounded-md hover:bg-(--color-primary-hover) transition-colors"
              onClick={() => router.push(`/${module}/${doctype}/new`)}
              title={t('Create New', 'Create New')}
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
            meta={meta}
            module={module}
            page={page}
            pageSize={pageSize}
            totalRecords={totalRecords}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            refreshData={fetchData}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        </div>
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline doctype={doctype} refreshTrigger={refreshActivity} />

      {/* Fields View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={t('Fields View Configuration', 'Fields View Configuration')}
        footer={
          <Button onClick={saveFieldsView}>{t('Save', 'Save')}</Button>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Select All Toggle (no border, slightly adjusted margin bottom) */}
          <label className="flex items-center gap-3 text-sm font-semibold text-(--color-text) cursor-pointer pb-1 mb-1">
            <input
              type="checkbox"
              checked={isAllChecked}
              onChange={handleSelectAllToggle}
              className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
            />
            {t('Select All', 'Select All')}
          </label>

          <div className="flex flex-col gap-3">
            {/* Allow ID field to be toggled */}
            <label className="flex items-center gap-3 text-sm font-medium text-(--color-text) cursor-pointer">
              <input
                type="checkbox"
                checked={tempVisibleColumns['id'] !== false}
                onChange={() => toggleTempColumnVisibility('id')}
                className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
              />
              ID
            </label>

            {meta?.fields
              ?.filter(f => f.fieldtype !== 'Table')
              ?.filter(f => !['id', 'password', 'pin', 'google_id', 'avatar_url', 'password_hash', 'pin_hash', 'is_deleted', 'status'].includes(f.fieldname))
              ?.map(f => (
                <label key={f.fieldname} className="flex items-center gap-3 text-sm font-medium text-(--color-text) cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempVisibleColumns[f.fieldname] !== false}
                    onChange={() => toggleTempColumnVisibility(f.fieldname)}
                    className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
                  />
                  {t(f.label, f.label)}
                </label>
              ))}
          </div>
        </div>
      </Modal>

      {/* Fields Filter Modal (Refactored: Shows Active in-list columns with toggle to database in_filter flag) */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title={t('Fields Filter Configuration', 'Fields Filter Configuration')}
        footer={
          <Button onClick={saveFieldsFilterConfig}>{t('Save', 'Save')}</Button>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Select All Toggle (no border, slightly adjusted margin bottom) */}
          <label className="flex items-center gap-3 text-sm font-semibold text-(--color-text) cursor-pointer pb-1 mb-1">
            <input
              type="checkbox"
              checked={isAllFiltersChecked}
              onChange={handleSelectAllFiltersToggle}
              className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
            />
            {t('Select All', 'Select All')}
          </label>

          <div className="flex flex-col gap-3">
            {fieldsActiveInList.map(f => (
              <label key={f.fieldname} className="flex items-center gap-3 text-sm font-medium text-(--color-text) cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempFilterFieldsConfig[f.fieldname] === true}
                  onChange={() => toggleTempFilterConfig(f.fieldname)}
                  className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
                />
                {t(f.label, f.label)}
              </label>
            ))}
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !bulkDeleting && setIsBulkDeleteModalOpen(false)}
        title={t('Delete Selected', 'Delete Selected')}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsBulkDeleteModalOpen(false)} disabled={bulkDeleting}>
              {t('Cancel', 'Cancel')}
            </Button>
            <Button variant="danger" onClick={executeBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? t('Deleting...', 'Deleting...') : t('Confirm', 'Confirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-(--color-text)">
            {t('Are you sure you want to delete these records?', 'Are you sure you want to delete these records?')} ({recordsToDelete.length})
          </p>
          {bulkDeleting && (
            <div className="text-sm text-(--color-muted)">
              {t('Progress', 'Progress')}: {bulkDeleteProgress.success + bulkDeleteProgress.failed} / {bulkDeleteProgress.total}
              {bulkDeleteProgress.failed > 0 && <span className="text-red-500 ml-2">({bulkDeleteProgress.failed} {t('Failed', 'Failed')})</span>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
