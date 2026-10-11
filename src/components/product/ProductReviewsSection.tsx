'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useProductReviews } from '@/hooks/useReviews';
import { createClient } from '@/lib/supabase/client';
import { ReviewForm } from './ReviewForm';
import { RatingsDisplay, ReviewsList } from './ReviewsDisplay';

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
  avgRating?: number;
  reviewCount?: number;
}

export function ProductReviewsSection({
  productId,
  productName = 'Product',
  avgRating = 0,
  reviewCount = 0,
}: ProductReviewsSectionProps) {
  const { user } = useAuthStore();
  const {
    reviews,
    loading,
    total,
    page,
    sort,
    breakdown,
    setPage,
    setSort,
    hasMorePages,
    refresh,
  } = useProductReviews(productId);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);

  // Check if user can review this product
  useEffect(() => {
    const checkReviewEligibility = async () => {
      if (!user || !productId) {
        setCanReview(false);
        setAlreadyReviewed(false);
        setCheckingPurchase(false);
        return;
      }

      try {
        const response = await fetch(`/api/reviews?productId=${productId}`, {
          headers: {
            'Authorization': `Bearer ${(await createClient().auth.getSession()).data.session?.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCanReview(data.canReview);
          setAlreadyReviewed(data.alreadyReviewed);
        } else {
          setCanReview(false);
          setAlreadyReviewed(false);
        }
      } catch (error) {
        console.error('Error checking review eligibility:', error);
        setCanReview(false);
        setAlreadyReviewed(false);
      } finally {
        setCheckingPurchase(false);
      }
    };

    checkReviewEligibility();
  }, [user, productId]);

  const handleReviewSubmitted = () => {
    setAlreadyReviewed(true);
    setShowReviewForm(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Ratings Overview */}
      <RatingsDisplay
        productId={productId}
        avgRating={avgRating}
        reviewCount={total}
        breakdown={breakdown}
      />

      {/* Review Form */}
      {user && (
        <>
          {!showReviewForm && !alreadyReviewed && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="w-full rounded-full bg-accent py-3 font-medium text-accent-on hover:bg-accent-hover"
            >
              Write a Review
            </button>
          )}

          {showReviewForm && !alreadyReviewed && (
            <ReviewForm
              productId={productId}
              onReviewSubmitted={handleReviewSubmitted}
              onClose={() => setShowReviewForm(false)}
              disabled={!canReview && !checkingPurchase}
              alreadyReviewed={alreadyReviewed}
            />
          )}

          {alreadyReviewed && !showReviewForm && (
            <div className="rounded-lg border border-accent bg-accent/10 p-4">
              <p className="text-sm text-accent-text">✓ You've already reviewed this product</p>
            </div>
          )}
        </>
      )}

      {!user && (
        <div className="rounded-lg border border-border bg-bg p-4 text-center">
          <p className="text-sm text-muted">Sign in to write a review</p>
        </div>
      )}

      {/* Reviews List */}
      <ReviewsList
        reviews={reviews}
        loading={loading}
        page={page}
        hasMorePages={hasMorePages}
        sort={sort}
        onPageChange={setPage}
        onSortChange={setSort}
      />
    </div>
  );
}