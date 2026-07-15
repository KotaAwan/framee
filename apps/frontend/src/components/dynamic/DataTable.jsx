import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Eye, Edit, Lock, Unlock, Trash2, Heart, MessageSquare, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useRouter } from 'next/router';
import QuickViewModal from './QuickViewModal';

export default function DataTable({
  data,
  columns,
  loading,
  doctype,
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
      id: 'actions',
      header: () => <div className="text-right">ACTIONS</div>,
      cell: ({ row }) => {
        const recordId = row.original.id || row.original.name;

        // Mock permission/status flags for now
        const status = row.original.status || 'Draft';
        const isLocked = status === 'Locked';

        const handleToggleLock = async () => {
          try {
            const newStatus = isLocked ? 'Active' : 'Locked';
            const { default: apiClient } = await import('../../lib/api.client');
            await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/toggle-lock`, { status: newStatus });
            if (refreshData) refreshData();
          } catch (err) {
            console.error('Failed to toggle lock status', err);
          }
        };

        return (
          <div className="flex items-center justify-end gap-3 text-(--color-muted)">
            {/* Status-based Actions */}
            {!isLocked ? (
              <>
                <button title="Lock" onClick={handleToggleLock} className="text-red-600 hover:text-red-700 transition-colors">
                  <Unlock size={16} />
                </button>
                <button title="Edit" className="hover:text-(--color-primary) transition-colors" onClick={() => router.push(`/document/${doctype}/${recordId}`)}>
                  <Edit size={16} />
                </button>
                <button title="Delete" className="text-red-500 hover:text-red-700 transition-colors" onClick={() => { if(confirm('Are you sure you want to delete this record?')) { /* Mock delete */ } }}>
                  <Trash2 size={16} />
                </button>
              </>
            ) : (
              <>
                <button title="Unlock" onClick={handleToggleLock} className="text-green-600 hover:text-green-700 transition-colors">
                  <Lock size={16} />
                </button>
                <button title="View" className="hover:text-(--color-primary) transition-colors" onClick={() => setViewRecordId(recordId)}>
                  <Eye size={16} />
                </button>
                <button title="Print" className="hover:text-purple-600 transition-colors" onClick={() => window.print()}>
                  <Printer size={16} />
                </button>
              </>
            )}

            {/* Socials */}
            <button className="flex items-center gap-1 hover:text-pink-500 text-xs ml-2" onClick={() => setViewRecordId(recordId)}>
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
          onClose={() => setViewRecordId(null)}
        />
      )}
      <div className="w-full flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-(--color-surface-hover) border-b border-(--color-border) text-(--color-muted)">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-4 py-3 font-medium">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
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
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 truncate max-w-[200px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
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
