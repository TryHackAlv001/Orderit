'use client';

import { useState } from 'react';
import { Star, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ReviewFormProps {
  productId: string;
  onReviewSubmitted?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  alreadyReviewed?: boolean;
}

export function ReviewForm({
  productId,
  onReviewSubmitted,
  onClose,
  disabled = false,
  alreadyReviewed = false,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Comment must be at least 10 characters');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to submit a review');
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ productId, rating, comment }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccess(true);
      setRating(0);
      setComment('');

      setTimeout(() => {
        onReviewSubmitted?.();
        onClose?.();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  if (alreadyReviewed) {
    return (
      <div className="rounded-lg border border-accent bg-accent/10 p-4">
        <div className="flex items-center gap-2 text-accent-text">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">You've already reviewed this product</p>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="rounded-lg border border-warning bg-warning/10 p-4">
        <div className="flex items-center gap-2 text-text">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">You must purchase and receive this product to review it</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6">
      <h3 className="font-semibold text-text">Write a Review</h3>

      {/* Star Rating */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition"
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hoveredRating || rating)
                    ? 'fill-warning text-text'
                    : 'text-muted'
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && <p className="text-sm text-muted">{rating} out of 5 stars</p>}
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <label htmlFor="comment" className="text-sm font-medium text-text">
          Your Comment
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this product (minimum 10 characters)"
          className="w-full rounded-lg border border-border px-4 py-3 focus:border-accent focus:outline-none"
          rows={4}
        />
        <p className="text-xs text-muted">
          {comment.length} / 10 characters minimum
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-3">
          <p className="text-sm text-danger-text">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-lg border border-success bg-success/10 p-3">
          <p className="text-sm text-text">Review submitted successfully!</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || success}
          className="flex-1 rounded-full bg-accent px-4 py-2.5 font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : success ? 'Submitted' : 'Submit Review'}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2.5 font-medium text-text hover:bg-bg"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}