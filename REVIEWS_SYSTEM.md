# Review & Ratings System

Complete implementation of a review and ratings system for the Tradeloft marketplace.

## Architecture

### Database Schema
- **reviews table**: Stores review submissions with buyer_id, product_id, rating, comment, timestamp
- **products table**: Updated with computed `rating` (average) and `review_count` after each review

### Components Structure

```
└── Review System
    ├── API Routes
    │   ├── POST /api/reviews — Submit new review
    │   └── GET /api/reviews/product/[productId] — Fetch paginated reviews
    ├── Hooks
    │   └── useReviews() — Manage review state and operations
    ├── Utilities
    │   ├── recalculateProductRating() — Update product avg rating
    │   ├── validateBuyerPurchased() — Check purchase eligibility
    │   ├── hasBuyerReviewedProduct() — Check if already reviewed
    │   └── getRatingBreakdown() — Get rating distribution
    └── Components
        ├── ReviewForm.tsx — Interactive review submission
        ├── RatingsDisplay.tsx — Overall ratings with breakdown chart
        ├── ReviewsList.tsx — Paginated reviews with sorting
        ├── RatingSummary.tsx — Compact rating display (for cards)
        └── ProductReviewsSection.tsx — Complete container component
```

## Usage

### 1. Display Reviews on Product Page

```tsx
import { ProductReviewsSection } from '@/components/product/ProductReviewsSection';

export default function ProductPage({ params: { productId } }) {
  const product = await fetchProduct(productId);

  return (
    <div>
      {/* Product details... */}
      
      <ProductReviewsSection
        productId={product.id}
        productName={product.name}
        avgRating={product.rating}
        reviewCount={product.review_count}
      />
    </div>
  );
}
```

### 2. Show Ratings on Product Cards

```tsx
import { RatingSummary } from '@/components/product/RatingSummary';

function ProductCard({ product }) {
  return (
    <div>
      {/* Product image... */}
      <RatingSummary
        rating={product.rating}
        reviewCount={product.review_count}
        size="sm"  // for cards use 'sm', for larger displays use 'md'
        showCount={true}
      />
    </div>
  );
}
```

### 3. Manually Trigger Review Submission

```tsx
import { useProductReviews } from '@/hooks/useReviews';

function MyComponent({ productId }) {
  const { submitReview } = useProductReviews(productId);

  const handleSubmit = async () => {
    try {
      const review = await submitReview(
        5, // rating: 1-5
        'Great product! Highly recommend.' // comment (optional)
      );
      console.log('Review submitted:', review);
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  return <button onClick={handleSubmit}>Submit Review</button>;
}
```

## Features

### Review Submission
- ✅ Only buyers who purchased and received the product can review
- ✅ Interactive 1-5 star rating selector
- ✅ Comment validation (minimum 10 characters)
- ✅ "Already reviewed" detection and messaging
- ✅ Automatic product rating recalculation after submission

### Ratings Display
- ✅ Large overall rating number with visual representation
- ✅ Rating breakdown bar chart showing percentage distribution
- ✅ Shows 5★, 4★, 3★, 2★, 1★ percentages

### Reviews List
- ✅ Paginated display (10 reviews per page)
- ✅ Reviewer avatar, name, date, stars, and comment
- ✅ Sorting options:
  - Most Recent (default)
  - Highest Rated
  - Lowest Rated
- ✅ Loading states and empty states

### Purchase Validation
- ✅ Ensures buyer actually purchased the product
- ✅ Requires order status to be "shipped" or "delivered"
- ✅ Blocks duplicate reviews by same buyer

### Product Rating Calculation
- ✅ Average rating calculated as: `sum(ratings) / count`
- ✅ Review count updated automatically
- ✅ Ratings rounded to 2 decimal places
- ✅ Real-time updates after each review

## API Endpoints

### POST /api/reviews
Submit a new review.

**Request:**
```json
{
  "productId": "uuid",
  "rating": 5,
  "comment": "Great product!"
}
```

**Responses:**
- `201 Created`: Review submitted successfully
- `400 Bad Request`: Invalid rating (not 1-5) or comment too short
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User didn't purchase the product
- `409 Conflict`: User already reviewed this product

### GET /api/reviews/product/[productId]
Fetch paginated reviews for a product.

**Query Parameters:**
- `limit`: Number of reviews per page (default: 10)
- `offset`: Pagination offset (default: 0)
- `sort`: Sort order - `recent`, `highest`, `lowest` (default: recent)

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "buyer_id": "uuid",
      "rating": 5,
      "comment": "Great!",
      "created_at": "2024-01-01T12:00:00Z",
      "buyer": {
        "id": "uuid",
        "full_name": "John Doe",
        "avatar_url": "https://..."
      }
    }
  ],
  "total": 42,
  "hasMore": true
}
```

## Validation Rules

### Review Submission
1. User must be authenticated (buyer)
2. Rating must be between 1-5
3. Comment (if provided) must be at least 10 characters
4. Buyer must have purchased and received the product
5. Buyer can only have one review per product
6. Product must exist and be active

### Purchase Eligibility
- Buyer must have an order containing the product
- Order status must be "shipped" or "delivered" (not pending/confirmed)
- Multiple purchases of same product: Only one review allowed per buyer

## Real-time Updates

The review system integrates with Supabase Realtime for:
- Live notification when new reviews are posted
- Automatic page refresh when ratings change
- Instant visibility of new reviews without page reload

## Error Handling

All components include proper error handling:
- Network errors → User-friendly error messages
- Validation errors → Specific error feedback
- Authorization errors → Clear messaging about why review can't be submitted

## Performance Considerations

- Reviews paginated to limit DOM elements
- Lazy loading of review data
- Optimized queries with indexing on: buyer_id, product_id, created_at
- Avatar images cached where possible
- Component memoization for large lists

## Mobile Responsiveness

- Fully responsive design
- Touch-friendly star rating selector
- Scrollable reviews list on mobile
- Collapsible rating breakdown
- Pagination controls scaled for touch