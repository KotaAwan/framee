import React, { useState } from 'react';
import { X, Heart, MessageSquare, Send } from 'lucide-react';
import DynamicForm from './DynamicForm';
import ActivityTimeline from './ActivityTimeline';
import apiClient from '../../lib/api.client';
import Icon from '../ui/Icon';
import Breadcrumb from '../layout/Breadcrumb';
import { useAuthStore } from '../../store/auth.store';

export default function QuickViewModal({ doctype, recordId, onClose }) {
  const currentUser = useAuthStore(state => state.user);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshTimeline, setRefreshTimeline] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/comment`, { comment });
      setComment('');
      setCommentCount(prev => prev + 1);
      // Wait for AuditEngine to flush before refreshing timeline
      setTimeout(() => setRefreshTimeline(prev => prev + 1), 1200);
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSending(false);
    }
  };

  const handleToggleLike = async (e) => {
    e.preventDefault();
    try {
      const action = isLiked ? 'UNLIKE' : 'LIKE';
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/like`, { action });
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      setTimeout(() => setRefreshTimeline(prev => prev + 1), 1200);
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  const [meta, setMeta] = useState(null);

  React.useEffect(() => {
    if (!doctype) return;
    apiClient.get(`/api/v1/meta/doctype/${doctype}`)
      .then(res => {
        if (res.data.success) {
          setMeta(res.data.data);
        }
      })
      .catch(err => console.error(err));
      
    if (recordId) {
      apiClient.get(`/api/v1/audit/doc/${doctype}/${recordId}?limit=100`)
        .then(res => {
          if (res.data.success) {
             const records = Array.isArray(res.data.data) ? res.data.data : (res.data.data.records || []);
             const likes = records.filter(r => r.action === 'LIKE').length;
             const unlikes = records.filter(r => r.action === 'UNLIKE').length;
             setLikeCount(Math.max(0, likes - unlikes));
             
             // Check if current user liked
             const myLastAction = records.find(r => r.user_id === currentUser?.id && (r.action === 'LIKE' || r.action === 'UNLIKE'));
             setIsLiked(myLastAction?.action === 'LIKE');
             
             const comments = records.filter(r => r.action === 'COMMENT').length;
             setCommentCount(comments);
          }
        })
        .catch(err => console.error(err));
    }
  }, [doctype, recordId, refreshTimeline]);

  const headerIcon = meta?.icon || 'Database';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm pt-10 sm:pt-16">
      <div className="bg-(--color-surface) rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-(--color-border)">

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-(--color-border) bg-transparent">
          <div className="flex items-center gap-2">
            <span className="text-(--color-primary) flex items-center justify-center">
              <Icon name={headerIcon} size={24} fallback="Database" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-(--color-text)">
              {meta?.label || meta?.name || doctype.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <div className="hidden sm:flex text-sm text-(--color-muted) font-medium items-center gap-2">
               <Breadcrumb mode="View" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-(--color-muted) hover:bg-(--color-surface-hover) hover:text-(--color-text) rounded-md transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-(--color-surface) p-6 flex flex-col gap-4">

          {/* Read-Only Form — pointer-events-none prevents editing */}
          <div className="pointer-events-none">
            <DynamicForm
              doctype={doctype}
              recordId={recordId}
              readOnly={true}
              isModal={true}
            />
          </div>

          {/* ── Social Bar ── no card, tight to the form above */}
          <div className="flex items-center gap-3">
            {/* Comment input */}
            <form onSubmit={handleAddComment} className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-lg text-sm focus:outline-none focus:border-(--color-primary) transition-all placeholder:text-(--color-input-placeholder)"
              />
              <button
                type="submit"
                disabled={sending || !comment.trim()}
                className="flex items-center gap-1.5 bg-(--color-primary) text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Send size={14} /> Send
              </button>
            </form>

            {/* Like & Comment counters */}
            <div className="flex items-center gap-3 text-sm text-(--color-muted)">
              <button
                type="button"
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 transition-colors ${
                  isLiked ? 'text-red-600' : 'hover:text-red-500'
                }`}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={16} className={isLiked ? 'fill-red-600 text-red-600' : ''} />
                <span className="font-medium">{likeCount}</span>
              </button>
              <div className="flex items-center gap-1.5 text-(--color-muted)">
                <MessageSquare size={16} />
                <span className="font-medium">{commentCount}</span>
              </div>
            </div>
          </div>

          {/* ── Activity Timeline Card ── */}
          <div>
            <ActivityTimeline
              doctype={doctype}
              recordId={recordId}
              refreshTrigger={refreshTimeline}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
