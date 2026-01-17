import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Edit2, Save, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FeedbackPanelProps {
  queryLogId: string;
  onSubmitFeedback: (queryLogId: string, rating: 0 | 1, correctedSql?: string, comment?: string) => void;
}

export function FeedbackPanel({ queryLogId, onSubmitFeedback }: FeedbackPanelProps) {
  const [rating, setRating] = useState<0 | 1 | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [correctedSql, setCorrectedSql] = useState('');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRating = (newRating: 0 | 1) => {
    setRating(newRating);
    
    if (newRating === 1) {
      // Thumbs up - submit immediately
      onSubmitFeedback(queryLogId, newRating);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } else {
      // Thumbs down - offer to edit
      setIsEditing(true);
    }
  };

  const handleSaveFeedback = () => {
    if (rating !== null) {
      onSubmitFeedback(queryLogId, rating, correctedSql || undefined, comment || undefined);
      setSubmitted(true);
      setIsEditing(false);
      
      // Show success message
      setTimeout(() => {
        setSubmitted(false);
        setCorrectedSql('');
        setComment('');
      }, 3000);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setRating(null);
    setCorrectedSql('');
    setComment('');
  };

  if (submitted) {
    return (
      <div className="mt-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
        <p className="text-sm text-green-400 font-medium">
          ✓ Thanks! This helps train our model.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Rating Buttons */}
      {!isEditing && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">Was this helpful?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRating(1)}
              disabled={rating !== null}
              className={cn(
                'p-2 rounded-lg transition-all',
                rating === 1
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'hover:bg-midnight-800 text-text-muted hover:text-green-400',
                rating !== null && rating !== 1 && 'opacity-50 cursor-not-allowed'
              )}
              title="Helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleRating(0)}
              disabled={rating !== null}
              className={cn(
                'p-2 rounded-lg transition-all',
                rating === 0
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'hover:bg-midnight-800 text-text-muted hover:text-red-400',
                rating !== null && rating !== 0 && 'opacity-50 cursor-not-allowed'
              )}
              title="Not helpful"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="p-4 rounded-lg bg-midnight-800 border border-midnight-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-text-main">
                Help us improve
              </span>
            </div>
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-midnight-700 text-text-muted hover:text-text-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-text-muted">Corrected SQL (optional)</span>
              <textarea
                value={correctedSql}
                onChange={(e) => setCorrectedSql(e.target.value)}
                placeholder="Paste the correct SQL here..."
                rows={4}
                className={cn(
                  'mt-1 w-full px-3 py-2 rounded-lg resize-none font-mono text-sm',
                  'bg-midnight-950 border border-midnight-700',
                  'text-text-main placeholder:text-text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'transition-all'
                )}
              />
            </label>

            <label className="block">
              <span className="text-xs text-text-muted">Additional feedback (optional)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What was wrong? How could we improve?"
                rows={2}
                className={cn(
                  'mt-1 w-full px-3 py-2 rounded-lg resize-none text-sm',
                  'bg-midnight-950 border border-midnight-700',
                  'text-text-main placeholder:text-text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'transition-all'
                )}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-main hover:bg-midnight-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveFeedback}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Submit Feedback</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
