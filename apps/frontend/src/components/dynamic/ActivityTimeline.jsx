import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import apiClient from '../../lib/api.client';

export default function ActivityTimeline({ doctype, recordId, refreshTrigger = 0 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    // Reset page on refreshTrigger change
    setPage(1);
  }, [refreshTrigger]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        let endpoint = `/api/v1/audit`;
        let params = { doctype, limit: 20 };

        if (recordId) {
          endpoint = `/api/v1/audit/doc/${doctype}/${recordId}`;
          params = { limit: 100 }; // Fetch all for modal
        } else {
          params = { doctype, limit: 20, offset: (page - 1) * 20 };
        }

        const res = await apiClient.get(endpoint, { params });
        if (res.data.success) {
          const fetchedLogs = Array.isArray(res.data.data) ? res.data.data : (res.data.data.records || []);
          
          if (!recordId) {
            if (page === 1) {
              setLogs(fetchedLogs);
            } else {
              setLogs(prev => [...prev, ...fetchedLogs]);
            }
            setHasMore(fetchedLogs.length === 20);
          } else {
            setLogs(fetchedLogs);
            setHasMore(false);
          }
        }
      } catch (e) {
        console.error('Failed to fetch logs', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [doctype, recordId, page, refreshTrigger]);

  const getActionStyle = (action) => {
    switch (action?.toUpperCase()) {
      case 'CREATED':    return { text: 'Created',  color: 'text-green-600' };
      case 'UPDATED':    return { text: 'Updated',  color: 'text-blue-600' };
      case 'DELETED':    return { text: 'Deleted',  color: 'text-red-600' };
      case 'LOCKED':     return { text: 'Locked',   color: 'text-orange-500' };
      case 'UNLOCKED':   return { text: 'Unlocked', color: 'text-purple-600' };
      case 'SUBMITTED':  return { text: 'Submitted',color: 'text-teal-600' };
      case 'CANCELLED':  return { text: 'Cancelled',color: 'text-red-500' };
      case 'LIKE':       return { text: 'Liked',    color: 'text-pink-500' };
      case 'UNLIKE':     return { text: 'Unliked',  color: 'text-gray-400' };
      case 'COMMENT':    return { text: 'Commented',color: 'text-indigo-500' };
      default:           return { text: action,     color: 'text-gray-500' };
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  return (
    <div className="bg-(--color-surface) rounded-lg border border-(--color-border) overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-(--color-border)">
        <Activity size={16} className="text-blue-500" />
        <span className="font-semibold text-sm text-(--color-text)">Activity Timeline</span>
      </div>

      {/* Timeline List */}
      <div className={`divide-y divide-(--color-border) transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {loading && logs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-(--color-muted) text-center">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-(--color-muted) text-center">No activity yet.</div>
        ) : (
          logs.map((log) => {
            const actionStyle = getActionStyle(log.action);
            const initial = log.user_name ? log.user_name.charAt(0).toUpperCase() : 'S';

            let metadata = null;
            try { metadata = log.metadata ? JSON.parse(log.metadata) : null; } catch (e) {}

            return (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-(--color-surface-hover)/50 transition-colors">
                {/* Avatar */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs overflow-hidden">
                  {log.avatar_url ? (
                    <img src={log.avatar_url} alt={log.user_name} className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-sm flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-(--color-text)">{log.user_name || 'System'}</span>
                  {log.doc_id && (
                    <span className="text-(--color-muted)">, ID {log.doc_id}</span>
                  )}
                  
                  {/* For COMMENT action */}
                  {log.action?.toUpperCase() === 'COMMENT' && metadata?.comment && (
                    <span className="text-(--color-muted) italic text-xs truncate max-w-xs">({metadata.comment})</span>
                  )}
                  
                  {/* For other actions */}
                  {log.change_summary && log.action?.toUpperCase() !== 'COMMENT' && (
                    <span className="text-(--color-muted) italic text-xs truncate max-w-xs">({log.change_summary})</span>
                  )}
                  
                  <span className={`font-semibold ${actionStyle.color}`}>{actionStyle.text}</span>
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 text-xs text-(--color-muted) whitespace-nowrap">
                  {formatTime(log.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="border-t border-(--color-border) p-3 flex justify-center bg-(--color-surface)">
          <button 
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
            className="text-sm font-medium text-(--color-primary) hover:text-(--color-primary-hover) disabled:opacity-50 transition-colors px-4 py-2 rounded-md hover:bg-(--color-surface-hover)"
          >
            {loading ? 'Loading...' : 'Load More...'}
          </button>
        </div>
      )}
    </div>
  );
}
