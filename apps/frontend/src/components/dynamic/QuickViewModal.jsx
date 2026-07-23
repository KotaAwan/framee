import React, { useState, useEffect, memo } from 'react';
import { X, Heart, MessageSquare, Send, Activity } from 'lucide-react';
import DynamicForm from './DynamicForm';
import ActivityTimeline from './ActivityTimeline';
import apiClient from '../../lib/api.client';
import Icon from '../ui/Icon';
import Breadcrumb from '../layout/Breadcrumb';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '@/hooks/useTranslation';

// ── Component #1: FormView (Memoized to prevent unnecessary re-renders)
const FormView = memo(function FormView({ doctype, recordId }) {
  return (
    <div className="pointer-events-none">
      <DynamicForm
        doctype={doctype}
        recordId={recordId}
        readOnly={true}
        isModal={true}
      />
    </div>
  );
});

// ── Component #2: FormComment (Holds its own local text state to avoid parent re-renders while typing)
function FormComment({ onSend, sending }) {
  const [comment, setComment] = useState('');
  const { t } = useTranslation();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim() || sending) return;
    onSend(comment);
    setComment('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("Write a comment...", "Write a comment...")}
        className="flex-1 px-4 py-2 bg-(--color-input-bg) text-(--color-input-text) border border-(--color-input-border) rounded-lg text-sm focus:outline-none focus:border-(--color-primary) transition-all placeholder:text-(--color-input-placeholder)"
      />
      <button
        type="submit"
        disabled={sending || !comment.trim()}
        className="flex items-center gap-1.5 bg-(--color-primary) text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        <Send size={14} /> {t('Send', 'Send')}
      </button>
    </form>
  );
}

// ── Component #3: LikeCommentBar (Displays counters and triggers toggle like)
function LikeCommentBar({ likeCount, commentCount, isLiked, onToggleLike }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-sm text-(--color-muted)">
      <button
        type="button"
        onClick={onToggleLike}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-(--color-surface-hover) transition-colors ${isLiked ? 'text-red-500' : ''}`}
        title={isLiked ? t('Unlike', 'Unlike') : t('Like', 'Like')}
      >
        <Heart size={16} className={isLiked ? 'fill-red-600 text-red-600' : ''} />
        <span className="font-medium">{likeCount}</span>
      </button>
      <div className="flex items-center gap-1.5 text-(--color-muted)">
        <MessageSquare size={16} />
        <span className="font-medium">{commentCount}</span>
      </div>
    </div>
  );
}

export default function QuickViewModal({ doctype, recordId, onClose }) {
  const currentUser = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'activity'
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [refreshTimeline, setRefreshTimeline] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [meta, setMeta] = useState(null);
  const [appLoading, setAppLoading] = useState(true);

  // Load metadata once when doctype changes
  useEffect(() => {
    if (!doctype) return;
    setAppLoading(true);
    apiClient.get(`/api/v1/meta/doctype/${doctype}`)
      .then(res => {
        if (res.data?.success) {
          setMeta(res.data.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        setAppLoading(false);
      });
  }, [doctype]);

  const handleAddComment = async (commentText) => {
    setSending(true);
    try {
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/comment`, { comment: commentText });
      setCommentCount(prev => prev + 1);
      setRefreshTimeline(prev => prev + 1);
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSending(false);
    }
  };

  const handleToggleLike = async (e) => {
    e?.preventDefault();
    try {
      const action = isLiked ? 'UNLIKE' : 'LIKE';
      await apiClient.post(`/api/v1/doc/${doctype}/${recordId}/like`, { action });
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      setRefreshTimeline(prev => prev + 1);
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  const headerIcon = meta?.icon || 'Database';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm pt-10 sm:pt-16">
      <div className="bg-(--color-surface) rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-(--color-border) relative">

        {appLoading && (
          <div className="absolute inset-0 z-50 bg-(--color-surface) flex flex-col items-center justify-center bg-opacity-90 backdrop-blur-sm transition-opacity duration-300">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--color-primary) mb-3"></div>
            <p className="text-(--color-muted) text-sm font-medium animate-pulse">{t("Loading view...", "Loading view...")}</p>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-(--color-border) bg-transparent">
          <div className="flex items-center gap-2">
            <span className="text-(--color-primary) flex items-center justify-center">
              <Icon name={headerIcon} size={24} fallback="Database" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-(--color-text)">
              {t(meta?.label || meta?.name || doctype.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), meta?.label || meta?.name || doctype.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))}
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
        <div className={`flex-1 overflow-y-auto bg-(--color-surface) p-6 flex flex-col gap-4 transition-opacity duration-500 ease-in-out ${appLoading ? 'opacity-0' : 'opacity-100'}`}>

          {/* Component #1: FormView */}
          <FormView doctype={doctype} recordId={recordId} />

          {/* Comment & Social Bar */}
          <div className="flex items-center gap-3">
            {/* Component #2: FormComment */}
            <FormComment onSend={handleAddComment} sending={sending} />

            {/* Component #3: LikeCommentBar */}
            <LikeCommentBar 
              likeCount={likeCount} 
              commentCount={commentCount} 
              isLiked={isLiked} 
              onToggleLike={handleToggleLike} 
            />
          </div>

          {/* Component #4: Activity Timeline */}
          <div>
            <ActivityTimeline
              doctype={doctype}
              recordId={recordId}
              refreshTrigger={refreshTimeline}
              onLogsLoaded={(records) => {
                const likes = records.filter(r => r.action === 'LIKE' || r.action === 'Liked').length;
                const unlikes = records.filter(r => r.action === 'UNLIKE' || r.action === 'Unliked').length;
                setLikeCount(Math.max(0, likes - unlikes));
                
                const myLastAction = records.find(r => r.user_id === currentUser?.id && (r.action === 'LIKE' || r.action === 'Liked' || r.action === 'UNLIKE' || r.action === 'Unliked'));
                setIsLiked(myLastAction?.action === 'LIKE' || myLastAction?.action === 'Liked');
                
                const comments = records.filter(r => r.action === 'COMMENT' || r.action === 'Commented').length;
                setCommentCount(comments);
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
