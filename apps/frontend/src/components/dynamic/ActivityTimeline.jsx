import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import apiClient from '../../lib/api.client';
import { useTranslation } from '@/hooks/useTranslation';

// ── Component #5: ListActivity (The actual list inside the card that fades in on reload)
function ListActivity({ loading, logs, doctype, recordId, refreshTrigger, page, hasMore, setPage, getActionStyle, formatTime }) {
  const { t } = useTranslation();
  return (
    <>
      <style>{`
        @keyframes timelineFadeIn {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .timeline-item-fade {
          opacity: 0;
          animation: timelineFadeIn 0.15s ease-out forwards;
        }
      `}</style>

      <div className="divide-y divide-(--color-border)">
        {loading && logs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-(--color-muted) text-center animate-pulse">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-(--color-muted) text-center">No activity yet.</div>
        ) : (
          logs.map((log, idx) => {
            const actionStyle = getActionStyle(log.action);
            const initial = log.user_name ? log.user_name.charAt(0).toUpperCase() : 'S';

            let metadata = null;
            try { metadata = log.metadata ? JSON.parse(log.metadata) : null; } catch (e) {}

            return (
              <div 
                key={log.id} 
                className="flex items-center gap-3 px-5 py-3 hover:bg-(--color-surface-hover)/50 transition-colors timeline-item-fade"
                style={{ animationDelay: `${idx * 10}ms` }}
              >
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
                  <span className="font-semibold text-(--color-text)">{log.user_name || t('System', 'System')}</span>
                  <span>
                    <span className={`font-semibold ${actionStyle.color}`}>{actionStyle.text}</span>
                    {log.doc_id && <span className="text-(--color-muted)">, ID {log.doc_id}</span>}
                  </span>
                  
                  {(log.content || metadata?.comment) && (
                    <span className="text-(--color-muted) italic text-xs truncate max-w-xs">({log.content || metadata?.comment})</span>
                  )}
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
            {loading ? 'Loading...' : t('LoadMore', 'Load More...')}
          </button>
        </div>
      )}
    </>
  );
}

// ── Component #4: ActivityTimeline (The card container, wrapper, and data orchestrator)
export default function ActivityTimeline({ doctype, recordId, refreshTrigger = 0, onLogsLoaded }) {
  const { t } = useTranslation();
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
        let params = { doctype, limit: 10 };

        if (recordId) {
          endpoint = `/api/v1/audit/doc/${doctype}/${recordId}`;
          params = { limit: 100 }; // Fetch all for modal
        } else {
          params = { doctype, limit: 10, offset: (page - 1) * 10 };
        }

        const res = await apiClient.get(endpoint, { params });
        if (res.data.success) {
          const fetchedLogs = Array.isArray(res.data.data) ? res.data.data : (res.data.data.records || []);
          
          if (onLogsLoaded) {
            onLogsLoaded(fetchedLogs);
          }

          if (!recordId) {
            if (page === 1) {
              setLogs(fetchedLogs);
            } else {
              setLogs(prev => {
                // Filter out any duplicates based on log.id
                const existingIds = new Set(prev.map(l => l.id));
                const newUniqueLogs = fetchedLogs.filter(l => !existingIds.has(l.id));
                return [...prev, ...newUniqueLogs];
              });
            }
            setHasMore(fetchedLogs.length === 10);
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
      case 'CREATED':    return { text: t('Created', 'Created'),  color: 'text-green-600' };
      case 'UPDATED':    return { text: t('Updated', 'Updated'),  color: 'text-blue-600' };
      case 'DELETED':    return { text: t('Deleted', 'Deleted'),  color: 'text-red-600' };
      case 'LOCKED':     return { text: t('Locked', 'Locked'),   color: 'text-orange-500' };
      case 'UNLOCKED':   return { text: t('Unlocked', 'Unlocked'), color: 'text-purple-600' };
      case 'SUBMITTED':  return { text: t('Submitted', 'Submitted'),color: 'text-teal-600' };
      case 'CANCELLED':  return { text: t('Cancelled', 'Cancelled'),color: 'text-red-500' };
      case 'LIKE':
      case 'LIKED':       return { text: t('Liked', 'Liked'),    color: 'text-pink-500' };
      case 'UNLIKE':
      case 'UNLIKED':     return { text: t('Unliked', 'Unliked'),  color: 'text-gray-400' };
      case 'COMMENT':
      case 'COMMENTED':    return { text: t('Commented', 'Commented'),color: 'text-indigo-500' };
      default:           return { text: t(action, action),     color: 'text-gray-500' };
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
      {/* Header (Component #4) */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-(--color-border)">
        <Activity size={16} className="text-blue-500" />
        <span className="font-semibold text-sm text-(--color-text)">{t('Activity Timeline', 'Activity Timeline')}</span>
      </div>

      {/* Component #5: ListActivity */}
      <ListActivity
        loading={loading}
        logs={logs}
        doctype={doctype}
        recordId={recordId}
        refreshTrigger={refreshTrigger}
        page={page}
        hasMore={hasMore}
        setPage={setPage}
        getActionStyle={getActionStyle}
        formatTime={formatTime}
      />
    </div>
  );
}
