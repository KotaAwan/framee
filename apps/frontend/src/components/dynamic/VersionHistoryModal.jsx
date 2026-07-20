import React, { useState, useEffect } from 'react';
import apiClient from '../../lib/api.client';
import { History, X } from 'lucide-react';

export default function VersionHistoryModal({ doctype, recordId, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchVersions() {
      try {
        const res = await apiClient.get(`/api/v1/doc/${doctype}/${recordId}/versions`);
        setVersions(res.data?.data || []);
      } catch (err) {
        setErrorMsg('Failed to load version history.');
      } finally {
        setLoading(false);
      }
    }
    fetchVersions();
  }, [doctype, recordId]);

  const handleRestore = async (versionNumber) => {
    if (!window.confirm(`Are you sure you want to restore to version ${versionNumber}?`)) return;
    try {
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/versions/${versionNumber}/restore`);
      alert('Version restored successfully. Please refresh the page.');
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore version.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History size={20} /> Version History
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {errorMsg && <div className="text-red-500 mb-4">{errorMsg}</div>}
          
          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : versions.length === 0 ? (
            <div className="text-center text-gray-500">No versions found.</div>
          ) : (
            <div className="space-y-4">
              {versions.map(v => (
                <div key={v.version_number} className={`p-4 border rounded-lg ${v.is_current ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        Version {v.version_number}
                        {v.is_current && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Current</span>}
                        {v.is_protected && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Protected</span>}
                      </h4>
                      <div className="text-sm text-gray-500 mt-1">
                        Saved by {v.saved_by_name} on {new Date(v.saved_at).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-700 mt-2">
                        <strong>Trigger:</strong> {v.trigger_event}
                        {v.change_summary && <span> &bull; {v.change_summary}</span>}
                      </div>
                    </div>
                    {!v.is_current && (
                      <button 
                        onClick={() => handleRestore(v.version_number)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
