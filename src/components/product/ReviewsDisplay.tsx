'use client';

import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReviewWithBuyer, RatingBreakdown } from '@/hooks/useReviews';

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function RatingBar({ rating, percentage, count }: { rating: number; percentage: number; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="w-8 text-right text-sm font-medium text-text">{rating}★</span>
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-surface-raised">
          <div
            className="h-2 rounded-full bg-warning transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="w-12 text-right text-sm text-muted">{percentage}%</div>
    </div>
  );
}

interface RatingsDisplayProps {
  productId: string;
  avgRating?: number;
  reviewCount?: number;
  breakdown?: RatingBreakdown | null;
}

export function RatingsDisplay({
  productId,
  avgRating = 0,
  reviewCount = 0,
  breakdown = null,
}: RatingsDisplayProps) {

  const fullStars = Math.floor(avgRating);
  const hasHalfStar = avgRating % 1 >= 0.5;

  return (
    <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
      {/* Overall Rating */}
      <div className="flex items-start gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl font-bold text-text">{avgRating.toFixed(1)}</div>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i}>
                {i < fullStars ? (
                  <Star className="h-5 w-5 fill-warning text-text" />
                ) : i === fullStars && hasHalfStar ? (
                  <div className="relative h-5 w-5">
                    <Star className="absolute h-5 w-5 text-muted" />
                    <div className="absolute h-5 w-2.5 overflow-hidden">
                      <Star className="h-5 w-5 fill-warning text-text" />
                    </div>
                  </div>
                ) : (
                  <Star className="h-5 w-5 text-muted" />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Rating Breakdown */}
        {breakdown ? (
          <div className="flex-1 space-y-2">
            <RatingBar rating={5} percentage={breakdown.percentages[5] || 0} count={breakdown.breakdown[5] || 0} />
            <RatingBar rating={4} percentage={breakdown.percentages[4] || 0} count={breakdown.breakdown[4] || 0} />
            <RatingBar rating={3} percentage={breakdown.percentages[3] || 0} count={breakdown.breakdown[3] || 0} />
            <RatingBar rating={2} percentage={breakdown.percentages[2] || 0} count={breakdown.breakdown[2] || 0} />
            <RatingBar rating={1} percentage={breakdown.percentages[1] || 0} count={breakdown.breakdown[1] || 0} />
          </div>
        ) : (
          <div className="flex-1 text-center text-sm text-muted py-4">
            No detailed breakdown available yet
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewsListProps {
  reviews: ReviewWithBuyer[];
  loading: boolean;
  page: number;
  hasMorePages: boolean;
  sort: string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: 'recent' | 'highest' | 'lowest') => void;
}

export function ReviewsList({
  reviews,
  loading,
  page,
  hasMorePages,
  sort,
  onPageChange,
  onSortChange,
}: ReviewsListProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
      {/* Header with Sort */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text">
          Reviews ({reviews.length})
        </h3>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as 'recent' | 'highest' | 'lowest')}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text focus:outline-none"
        >
          <option value="recent">Most Recent</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-surface-raised"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-raised rounded w-1/4"></div>
                    <div className="h-3 bg-surface-raised rounded w-1/3"></div>
                    <div className="h-3 bg-surface-raised rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p className="text-sm">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-border p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-3">
                {/* Reviewer Avatar */}
                <div className="h-10 w-10 rounded-full bg-surface-raised flex items-center justify-center flex-shrink-0">
                  {review.buyer?.avatar_url ? (
                    <img
                      src={review.buyer.avatar_url}
                      alt={review.buyer?.full_name || 'Reviewer'}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-muted">
                      {(review.buyer?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>

                {/* Review Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div>
                      <p className="font-medium text-text">
                        {review.buyer?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-muted">{formatDate(review.created_at)}</p>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? 'fill-warning text-text'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Comment */}
                  {review.comment && (
                    <p className="text-sm text-text line-clamp-3">{review.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {reviews.length > 0 && (hasMorePages || page > 1) && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded-full p-2 text-muted hover:text-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-muted">Page {page}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMorePages}
            className="rounded-full p-2 text-muted hover:text-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}