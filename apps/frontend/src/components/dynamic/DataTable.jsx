import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Eye, Edit, Trash2, Heart, MessageSquare, ChevronLeft, ChevronRight, Printer, Unlock, Lock } from 'lucide-react';
import { useRouter } from 'next/router';
import QuickViewModal from './QuickViewModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export default function DataTable({
  data,
  columns,
  loading,
  doctype,
  module,
  page,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  rowSelection = {},
  setRowSelection = () => { },
  refreshData
}) {
  const router = useRouter();
  const [viewRecordId, setViewRecordId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Dynamically generate column definitions for TanStack Table
  const tableColumns = useMemo(() => {
    // 1. Checkbox column
    const cols = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      }
    ];

    // 2. Data columns
    columns.forEach(col => {
      const accessorKey = typeof col === 'string' ? col : col.accessorKey;
      const headerText = typeof col === 'string' ? col.replace(/_/g, ' ').toUpperCase() : col.header;
      
      cols.push({
        accessorKey,
        header: headerText,
        cell: info => {
          const val = info.getValue();
          if (col.type === 'Check') {
            return (val === 1 || val === true || val === '1' || val === 'true') ? 'Yes' : 'No';
          }
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return String(val ?? '-');
        }
      });
    });

    // 3. Action column
    cols.push({
      size: 140,
      id: 'actions',
      header: () => <div className="text-left font-semibold">Action</div>,
      cell: ({ row }) => {
        const recordId = row.original.id || row.original.name;

        const status = row.original.status || 'New';
        const isSaved = status === 'Saved';
        const isDraft = status === 'Draft';
        const isNew = status === 'New';

        // Check if print is supported (we'd check doctype options, but standard fallback is true or button action)
        const isPrintable = true; // Fallback for standard doctypes

        return (
          <div className="flex items-center justify-start gap-3 text-(--color-muted)">
            {/* 1. Saved State Actions */}
            {isSaved && (
              <>
                {/* buttonLock hijau: click -> Action "Unlock" -> state "Draft" (log Unlocked) */}
                <button title="Unlock" className="text-green-600 hover:text-green-700 transition-colors" onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Unlock Record',
                    message: 'Are you sure you want to unlock this record to Draft?',
                    onConfirm: async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                      try {
                        const apiClient = (await import('../../lib/api.client')).default;
                        await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/workflow/transition`, {
                          action: 'Unlock',
                          comment: 'Unlocked from list view'
                        });
                        if (refreshData) {
                          setTimeout(() => refreshData(), 200);
                        }
                      } catch (e) {
                        console.error(e);
                        alert('Failed to unlock record');
                      }
                    }
                  });
                }}>
                  <Lock size={16} />
                </button>

                {/* iconEye for View */}
                <button title="View" className="hover:text-(--color-primary) transition-colors" onClick={() => setViewRecordId(recordId)}>
                  <Eye size={16} />
                </button>

                {/* iconPrint for print format */}
                {isPrintable && (
                  <button title="Print" className="hover:text-purple-600 transition-colors" onClick={async () => {
                    try {
                      const apiClient = (await import('../../lib/api.client')).default;
                      const res = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}/print`, { responseType: 'text' });
                      const win = window.open('', '_blank');
                      win.document.write(res.data);
                      win.document.close();
                      win.focus();
                      setTimeout(() => win.print(), 500);
                    } catch (err) {
                      console.error('Print error:', err);
                      alert('Failed to load print format.');
                    }
                  }}>
                    <Printer size={16} />
                  </button>
                )}
              </>
            )}

            {/* 2. Draft State Actions */}
            {isDraft && (
              <>
                {/* buttonUnLock merah: click -> Action "Lock" -> state "Saved" (log Locked) */}
                <button title="Lock" className="text-red-600 hover:text-red-700 transition-colors" onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Lock Record',
                    message: 'Are you sure you want to lock this record to Saved?',
                    onConfirm: async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                      try {
                        const apiClient = (await import('../../lib/api.client')).default;
                        await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/workflow/transition`, {
                          action: 'Lock',
                          comment: 'Locked from list view'
                        });
                         if (refreshData) {
                           setTimeout(() => refreshData(), 200);
                         }
                      } catch (e) {
                        console.error(e);
                        alert('Failed to lock record');
                      }
                    }
                  });
                }}>
                  <Unlock size={16} />
                </button>

                {/* iconEdit for Form Edit */}
                <button title="Edit" className="text-blue-600 hover:text-blue-700 transition-colors" onClick={() => router.push(`/${module || 'doctype'}/${doctype}/${recordId}`)}>
                  <Edit size={16} />
                </button>

                {/* iconTrash for Delete */}
                <button title="Delete" className="text-red-600 hover:text-red-700 transition-colors" onClick={() => { 
                  setConfirmModal({
                    isOpen: true,
                    title: 'Delete Record',
                    message: 'Are you sure you want to delete this record?',
                    onConfirm: async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                      try {
                        const apiClient = (await import('../../lib/api.client')).default;
                        await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/workflow/transition`, {
                          action: 'Delete',
                          comment: 'Deleted from list view'
                        });
                        if (refreshData) refreshData();
                      } catch (e) {
                        console.error(e);
                        alert('Failed to delete record');
                      }
                    }
                  });
                }}>
                  <Trash2 size={16} />
                </button>
              </>
            )}

            {/* 3. New State Actions */}
            {isNew && (
              <>
                {/* iconEdit for Form Edit */}
                <button title="Edit" className="hover:text-(--color-primary) transition-colors" onClick={() => router.push(`/${module || 'doctype'}/${doctype}/${recordId}`)}>
                  <Edit size={16} />
                </button>
              </>
            )}
          </div>
        );
      }
    });

    // 4. Social column (Like, Comment)
    cols.push({
      id: 'socials',
      size: 90,
      header: () => <div className="text-left font-semibold"></div>,
      cell: ({ row }) => {
        const recordId = row.original.id || row.original.name;
        return (
          <div className="flex items-center justify-start gap-3 text-(--color-muted)">
            {/* Socials */}
            <button className="flex items-center gap-1 hover:text-pink-500 text-xs" onClick={() => setViewRecordId(recordId)}>
              <Heart size={14} className={row.original.is_liked ? "fill-red-600 text-red-600" : ""} /> {row.original.likes || 0}
            </button>
            <button className="flex items-center gap-1 hover:text-indigo-500 text-xs" onClick={() => setViewRecordId(recordId)}>
              <MessageSquare size={14} /> {row.original.comments || 0}
            </button>
          </div>
        );
      }
    });

    return cols;
  }, [columns, doctype, router, setViewRecordId, refreshData]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      {viewRecordId && (
        <QuickViewModal
          doctype={doctype}
          recordId={viewRecordId}
          onClose={() => {
            setViewRecordId(null);
            if (refreshData) refreshData();
          }}
        />
      )}

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
            <Button onClick={confirmModal.onConfirm} variant="primary">Confirm</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{confirmModal.message}</p>
      </Modal>

      <div className="w-full flex flex-col">
        <div className="overflow-x-auto">
          <table className="text-sm text-left border-collapse" style={{ tableLayout: 'auto', width: '100%' }}>
            <thead className="text-xs uppercase bg-(--color-surface-hover) border-b border-(--color-border) text-(--color-muted)">
              {table.getHeaderGroups().map(headerGroup => {
                // Build a custom header row merging 'actions' + 'socials' into one colspan=2 cell
                const headers = headerGroup.headers;
                const renderedHeaders = [];
                let i = 0;
                while (i < headers.length) {
                  const header = headers[i];
                  if (header.column.id === 'actions') {
                    // Merge with next socials header
                    renderedHeaders.push(
                      <th key="actions-merged" colSpan={2} className="px-3 py-3 font-medium whitespace-nowrap text-left">
                        Action
                      </th>
                    );
                    i += 2; // skip both actions and socials
                  } else {
                    const isCheckbox = header.column.id === 'select';
                    renderedHeaders.push(
                      <th
                        key={header.id}
                        className={`px-3 py-3 font-medium${isCheckbox ? ' w-8' : ''}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                    i++;
                  }
                }
                return <tr key={headerGroup.id}>{renderedHeaders}</tr>;
              })}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-4 py-12 text-center text-(--color-muted)">
                    Loading data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-4 py-12 text-center text-(--color-muted)">
                    No records found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-(--color-border) hover:bg-(--color-surface-hover) transition-colors">
                    {row.getVisibleCells().map(cell => {
                      const isActions = cell.column.id === 'actions';
                      const isSocials = cell.column.id === 'socials';
                      const isCheckbox = cell.column.id === 'select';
                      return (
                        <td
                          key={cell.id}
                          className={
                            isCheckbox
                              ? 'px-3 py-3 w-8'
                              : isActions || isSocials
                                ? 'px-3 py-3 whitespace-nowrap w-px'
                                : 'px-3 py-3 truncate max-w-[240px]'
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


        {/* Pagination Bar */}
        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-(--color-border) text-xs text-(--color-muted) bg-(--color-surface)">
          <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
            <div className="relative">
              <select
                className="appearance-none border border-(--color-border) rounded-md py-1.5 pl-3 pr-8 bg-(--color-input-bg) focus:outline-none focus:border-(--color-primary) text-(--color-text)"
                value={pageSize}
                onChange={e => onPageSizeChange(Number(e.target.value))}
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-(--color-muted)">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
            <span>Showing {Math.min(data.length, pageSize)} of {totalRecords} rows</span>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span>Showing {page} of {Math.max(1, Math.ceil(totalRecords / pageSize))} pages</span>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 border border-(--color-border) rounded bg-transparent text-(--color-text) transition-colors disabled:opacity-30 disabled:bg-(--color-surface-hover) enabled:hover:bg-(--color-primary) enabled:hover:text-white enabled:hover:border-(--color-primary)"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="p-1.5 border border-(--color-border) rounded bg-transparent text-(--color-text) transition-colors disabled:opacity-30 disabled:bg-(--color-surface-hover) enabled:hover:bg-(--color-primary) enabled:hover:text-white enabled:hover:border-(--color-primary)"
                disabled={page * pageSize >= totalRecords}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
