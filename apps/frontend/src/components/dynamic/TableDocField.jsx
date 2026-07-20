import React, { useState, useEffect } from 'react';
import { useFieldArray } from 'react-hook-form';
import apiClient from '../../lib/api.client';
import { Plus, Trash2 } from 'lucide-react';

export default function TableDocField({ fieldname, label, options, control, register, error }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldname
  });
  
  const [columns, setColumns] = useState([]);
  
  useEffect(() => {
    // Fetch child doctype schema
    if (options) {
      apiClient.get(`/api/v1/meta/doctype/${options}`).then(res => {
        const metaFields = res.data?.data?.fields || [];
        // Only show fields that are in_list, or just take first 5 non-system fields
        const listCols = metaFields.filter(f => f.in_list && !f.is_hidden);
        setColumns(listCols.length > 0 ? listCols : metaFields.filter(f => !f.is_hidden).slice(0, 5));
      }).catch(console.error);
    }
  }, [options]);
  
  return (
    <div className="flex flex-col mb-4 col-span-12">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-(--color-text)">{label}</label>
      </div>
      <div className="overflow-x-auto border rounded-md border-(--color-border)">
        <table className="w-full text-sm text-left">
          <thead className="bg-(--color-surface-hover) border-b border-(--color-border)">
            <tr>
              <th className="px-3 py-2 w-10 text-center text-gray-500">#</th>
              {columns.map(col => (
                <th key={col.fieldname} className="px-3 py-2 font-medium text-(--color-text)">{col.label}</th>
              ))}
              <th className="px-3 py-2 w-12 text-center text-gray-500">Act</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((item, index) => (
              <tr key={item.id} className="border-b border-(--color-border) last:border-0 hover:bg-(--color-surface-hover)/50 transition-colors">
                <td className="px-3 py-2 text-center text-gray-400">{index + 1}</td>
                {columns.map(col => (
                  <td key={col.fieldname} className="px-2 py-1">
                    <input
                      {...register(`${fieldname}.${index}.${col.fieldname}`)}
                      type={col.fieldtype === 'Int' || col.fieldtype === 'Float' || col.fieldtype === 'Currency' ? 'number' : 'text'}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-sm bg-(--color-input-bg) focus:outline-none focus:ring-1 focus:ring-(--color-primary) focus:border-(--color-primary) transition-all text-sm"
                      placeholder={col.label}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <button 
                    type="button" 
                    onClick={() => remove(index)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-gray-400 italic">
                  No {label} items yet. Click Add Row to insert data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => append({})}
          className="flex items-center text-sm text-(--color-primary) font-medium hover:text-(--color-primary-hover) bg-(--color-primary)/10 hover:bg-(--color-primary)/20 px-3 py-1.5 rounded-md w-fit transition-colors"
        >
          <Plus size={16} className="mr-1" /> Add Row
        </button>
      </div>
      {error && <span className="text-red-500 text-xs mt-1">{error.message || 'Error in table'}</span>}
    </div>
  );
}
