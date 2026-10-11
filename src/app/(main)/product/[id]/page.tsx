'use client';

import { useState, useEffect, useMemo } from 'react';
import { MessageVendorButton } from '@/components/messaging/MessageVendorButton';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Star, ShoppingCart, MessageSquare, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, getCurrencyOption } from '@/constants';
import { useCurrencyStore } from '@/store/currencyStore';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { ProductReviewsSection } from '@/components/product/ProductReviewsSection';
import Script from 'next/script';
import { Product as GlobalProduct } from '@/types';
import { getSizeConfig, getSizeLabel } from '@/constants/sizes';
import { getSizeGuideKey, SIZE_GUIDES } from '@/constants/size-guides';

interface ProductWithVendor extends GlobalProduct {
  vendor: {
    id: string;
    userId: string;
    shop_name: string;
    rating: number;
    total_sales: number;
    created_at: string;
    is_verified: boolean;
  };
  category: {
    slug?: string;
    name: string;
  };
  updated_at: string;
}

interface ProductSizeVariant {
  size: string | null;
  stock_quantity: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [product, setProduct] = useState<ProductWithVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [sizeVariants, setSizeVariants] = useState<ProductSizeVariant[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const currency = getCurrencyOption(useCurrencyStore((state) => state.currency));
  const addItem = useCartStore((state) => state.addItem);
  const { user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const fetchProduct = async () => {
      try {
        setLoading(true);

        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*, category:categories(name,slug)')
          .eq('id', productId)
          .eq('is_active', true)
          .single();

        if (cancelled) return;

        if (productError || !productData) {
          setProduct(null);
          setLoading(false);
          return;
        }

        setProduct({
          ...productData,
          created_at: new Date(productData.created_at),
          vendor: {
            id: productData.vendor_id,
            userId: productData.vendor_id,
            shop_name: 'Vendor Store',
            rating: 0,
            total_sales: 0,
            created_at: '',
            is_verified: false,
          },
          category: productData.category || { name: 'Uncategorized' },
        });
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("size,stock_quantity")
          .eq("product_id", productId);
        if (variantsError) {
          console.error("Unable to load product size inventory:", variantsError.message);
          setCartError("Unable to load size availability. Please refresh and try again.");
        } else {
          setSizeVariants(variants ?? []);
        }
        setSelectedSize(null);
        setMainImage(0);
        setLoading(false);

        try {
          const { data: vendorData, error: vendorError } = await supabase
            .from('vendor_profiles')
            .select('id, user_id, shop_name, rating, total_sales, created_at, is_verified')
            .eq('user_id', productData.vendor_id)
            .maybeSingle();

          if (cancelled) return;

          if (vendorError) {
            console.error('Error fetching product vendor:', vendorError);
          } else if (vendorData) {
            setProduct((currentProduct) => currentProduct && currentProduct.id === productId ? {
              ...currentProduct,
              vendor: {
                id: vendorData.id,
                userId: vendorData.user_id,
                shop_name: vendorData.shop_name || 'Vendor Store',
                rating: vendorData.rating ?? 0,
                total_sales: vendorData.total_sales ?? 0,
                created_at: vendorData.created_at || '',
                is_verified: vendorData.is_verified ?? false,
              },
            } : currentProduct);
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Error fetching product vendor:', error);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching product:', error);
        setProduct(null);
        setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, supabase]);

  const handleAddToCart = async () => {
    if (product) {
      const sizeConfig = getSizeConfig(product.category?.slug ?? product.category?.name);
      const requiresSize = product.size_type
        ? product.size_type !== "none"
        : sizeConfig.type !== "none";
      if (requiresSize && !selectedSize) {
        setCartError(`Select a ${sizeConfig.label.toLowerCase()} before adding this product.`);
        return;
      }
      if (selectedSize && sizeStockByValue[selectedSize] < quantity) {
        setCartError("There is not enough stock for the selected size.");
        return;
      }
      setCartError(null);
      // Update local Zustand state for immediate UI feedback
      addItem({
        id: product.id,
        product,
        quantity,
        selected_size: selectedSize,
        vendor: {
          id: product.vendor.id,
          shop_name: product.vendor.shop_name,
        },
      });

      // If user is logged in, sync to the database
      if (user) {
        try {
          let existingQuery = supabase
            .from("cart_items")
            .select("id,quantity")
            .eq("user_id", user.id)
            .eq("product_id", product.id);
          existingQuery = selectedSize
            ? existingQuery.eq("selected_size", selectedSize)
            : existingQuery.is("selected_size", null);
          const { data: existingLine, error: findError } = await existingQuery.maybeSingle();
          if (findError) throw findError;
          const result = existingLine
            ? await supabase.from("cart_items")
                .update({ quantity: existingLine.quantity + quantity })
                .eq("id", existingLine.id)
            : await supabase.from("cart_items").insert({
                user_id: user.id,
                product_id: product.id,
                vendor_id: product.vendor.id,
                quantity,
                selected_size: selectedSize,
              });
          if (result.error) throw result.error;
        } catch (err) {
          console.error('Failed to sync cart to database:', err);
          setCartError("Added to this device's cart, but could not sync your account cart.");
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-3xl font-bold text-text">Product Not Found</h1>
        <p className="mt-2 text-muted">This product may have been removed or is no longer available.</p>
        <Link href="/marketplace">
          <Button className="mt-4">Back to Marketplace</Button>
        </Link>
      </div>
    );
  }

  const discount = product.compare_price ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100) : null;
  const isOwner = user?.role === 'vendor' && user.id === product.vendor_id;
  const sizeConfig = getSizeConfig(product.category?.slug ?? product.category?.name);
  const requiresSize = product.size_type
    ? product.size_type !== "none"
    : sizeConfig.type !== "none";
  const availableSizes = Array.from(new Set([
    ...(product.available_sizes ?? []),
    ...sizeVariants.map((variant) => variant.size).filter((size): size is string => Boolean(size)),
  ]));
  const sizeStockByValue = sizeVariants.reduce<Record<string, number>>((stock, variant) => {
    if (variant.size) stock[variant.size] = (stock[variant.size] ?? 0) + variant.stock_quantity;
    return stock;
  }, {});
  const selectedSizeStock = selectedSize ? sizeStockByValue[selectedSize] ?? 0 : product.stock_quantity;
  const sizeGuideKey = getSizeGuideKey(product.category?.slug ?? product.category?.name);
  const sizeGuide = sizeGuideKey ? SIZE_GUIDES[sizeGuideKey] : null;
  const canAddToCart = product.stock_quantity > 0 &&
    (!requiresSize || (selectedSize !== null && selectedSizeStock >= quantity));

  return (
    <div className="space-y-8">
      {/* Main Product Section */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-raised">
            {product.images[mainImage] ? (
              <Image
                src={product.images[mainImage]}
                alt={product.name}
                fill // Removed duplicate className
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No Image</div>
            )}
            {discount && (
              <Badge variant="danger" className="absolute left-4 top-4">-{discount}%</Badge>
            )}
            {product.stock_quantity === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/90">
                <span className="text-2xl font-bold text-text">Out of Stock</span>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((image, idx) => (
                <button
                  key={idx}
                  onClick={() => setMainImage(idx)}
                  className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border transition-colors duration-200 ${
                    mainImage === idx ? 'border-accent' : 'border-border'
                  } `}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${idx + 1}`}
                    fill // Removed duplicate className
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Category Badge */}
          {product.category?.name && (
            <Badge className="w-fit border border-border bg-transparent text-muted">{product.category.name}</Badge>
          )}

          {/* Title and Vendor */}
          <div>
            <h1 className="text-3xl font-bold text-text">{product.name}</h1>
            <Link
              href={`/vendor/${product.vendor.id}`}
              className="mt-2 text-accent-text transition-colors duration-200 hover:text-accent-text hover:underline"
            >
              {product.vendor.shop_name}
              {product.vendor.is_verified && <Badge variant="success" className="ml-2">Verified</Badge>}
            </Link>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.floor(product.rating) ? 'fill-accent text-accent-text' : 'text-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted">({product.review_count} reviews)</span>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-accent-text">
                {formatCurrency(product.price, currency.code, currency.locale)}
              </span>
              {product.compare_price && (
                <span className="text-lg text-muted line-through">
                  {formatCurrency(product.compare_price, currency.code, currency.locale)}
                </span>
              )}
            </div>
            {product.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-surface-raised px-3 py-1 text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {product.stock_quantity > 0 ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm font-medium text-text">
                  {product.stock_quantity} in stock
                </span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-danger" />
                <span className="text-sm font-medium text-danger-text">Out of Stock</span>
              </>
            )}
          </div>

          {requiresSize && (
            <section className="space-y-3" aria-labelledby="product-size-label">
              <div className="flex items-center justify-between gap-3">
                <h2 id="product-size-label" className="text-sm font-semibold text-text">{sizeConfig.label}</h2>
                {sizeGuide && (
                  <button type="button" onClick={() => setSizeGuideOpen(true)}
                    className="text-sm font-medium text-accent-text underline underline-offset-2 transition-colors duration-200 hover:text-accent-text">
                    Size guide
                  </button>
                )}
              </div>
              {availableSizes.length ? (
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const inStock = (sizeStockByValue[size] ?? 0) > 0;
                    return (
                      <button key={size} type="button" disabled={!inStock}
                        aria-pressed={selectedSize === size}
                        onClick={() => {
                          setSelectedSize(size);
                          setQuantity((current) => Math.min(current, sizeStockByValue[size] ?? 1));
                          setCartError(null);
                        }}
                        className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                          selectedSize === size
                            ? "border-accent bg-accent/10 text-text"
                            : "border-border bg-surface text-text hover:border-accent/50"
                        }`}
                      >
                        {size}
                        {!inStock && <span className="ml-1 text-xs font-normal">Sold out</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-text">
                  Size options are not available for this product yet. Contact the seller for help.
                </p>
              )}
              {selectedSize && (
                <p className="text-sm text-muted">
                  {getSizeLabel(product.category?.slug ?? product.category?.name, selectedSize)} · {selectedSizeStock} in stock
                </p>
              )}
              {cartError && <p role="alert" className="text-sm text-danger-text">{cartError}</p>}
            </section>
          )}

          {!isOwner ? (
            <>
              {product.stock_quantity > 0 && (
                <div className="space-y-4">
                  {!requiresSize && cartError && <p role="alert" className="text-sm text-danger-text">{cartError}</p>}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Quantity:</label>
                    <div className="flex items-center rounded-md border border-border bg-surface">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-2 transition-colors duration-200 hover:bg-surface-raised"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={selectedSizeStock}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.min(selectedSizeStock, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 border-l border-r border-border bg-transparent px-2 py-2 text-center text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(selectedSizeStock, quantity + 1))}
                        className="px-3 py-2 transition-colors duration-200 hover:bg-surface-raised"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button className="w-full" disabled={!canAddToCart} onClick={handleAddToCart}>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Add to Cart
                    </Button>
                  </div>
                </div>
              )}

              {/* Secondary Buttons */}
              <div className="flex gap-2 border-t border-border pt-4">
                <MessageVendorButton
                  vendorUserId={product.vendor.userId}
                  vendorName={product.vendor.shop_name}
                  className="flex-1"
                />
                <Button variant="outline" className="flex-1">
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
                <Button variant="outline" className="flex-1">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-surface-raised p-6">
              <p className="text-sm font-medium text-text">This is your product listing.</p>
              <div className="mt-4">
                <Link
                  href={`/vendor/products/${product.id}/edit`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95"
                >
                  Edit Product
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {sizeGuideOpen && sizeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 p-4" role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setSizeGuideOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="size-guide-title"
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="size-guide-title" className="text-xl font-semibold text-text">{sizeGuide.title}</h2>
                <p className="mt-2 text-sm text-muted">{sizeGuide.note}</p>
              </div>
              <button type="button" aria-label="Close size guide" onClick={() => setSizeGuideOpen(false)}
                className="min-h-10 min-w-10 rounded-md bg-surface-raised text-lg text-text">×</button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <tbody>
                  {sizeGuide.rows.map((row, index) => (
                    <tr key={row.join("-")} className={index === 0 ? "bg-surface-raised font-semibold" : "border-t border-border"}>
                      {row.map((cell) => <td key={cell} className="px-3 py-2.5 text-text">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Tabs Section */}
      <div className="border-b border-border">
        <div className="flex gap-8 overflow-x-auto">
          {['description', 'reviews', 'vendor'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-4 font-medium capitalize transition-colors duration-200 ${
                activeTab === tab
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab === 'description' ? 'Description' : tab === 'reviews' ? 'Reviews' : 'Vendor Info'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {/* Description Tab */}
        {activeTab === 'description' && (
          <div className="max-w-3xl space-y-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-text">
              {product.description || 'No description available.'}
            </div>
            {product.sku && (
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted">
                  <strong>SKU:</strong> {product.sku}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <ProductReviewsSection
            productId={product.id}
            productName={product.name}
            avgRating={product.rating}
            reviewCount={product.review_count}
          />
        )}

        {/* Vendor Info Tab */}
        {activeTab === 'vendor' && (
          <div className="max-w-2xl space-y-6">
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-2xl font-bold text-text">{product.vendor.shop_name}</h3>
                    {product.vendor.is_verified && (
                      <Badge variant="success" className="mt-2">Verified Seller</Badge>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted">Seller Rating</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-5 w-5 fill-accent text-accent-text" />
                        <span className="font-semibold">{product.vendor.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted">Total Sales</p>
                      <p className="mt-1 font-semibold">{product.vendor.total_sales}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted">Member Since</p>
                      <p className="mt-1 font-semibold">
                        {Number.isNaN(Date.parse(product.vendor.created_at))
                          ? '—'
                          : new Date(product.vendor.created_at).getFullYear()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-border pt-6">
                {isOwner ? (
                  <div className="space-y-4 rounded-lg border border-border bg-surface-raised p-4">
                    <p className="text-sm font-medium text-text">This is your product listing.</p>
                    <Link
                      href={`/vendor/products/${product.id}/edit`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm text-accent-on transition-colors duration-200 hover:brightness-95"
                    >
                      Edit Product
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Quantity Selector */}
                    {product.stock_quantity > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium">Quantity:</label>
                          <div className="flex items-center rounded-md border border-border bg-surface">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="px-3 py-2 transition-colors duration-200 hover:bg-surface-raised"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 border-l border-r border-border bg-transparent px-2 py-2 text-center text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <button
                              onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                              className="px-3 py-2 transition-colors duration-200 hover:bg-surface-raised"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          <Button className="w-full" onClick={handleAddToCart}>
                            <ShoppingCart className="mr-2 h-5 w-5" />
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Secondary Buttons */}
                    <div className="flex gap-2 border-t border-border pt-4">
                      <MessageVendorButton
                        vendorUserId={product.vendor.userId}
                        vendorName={product.vendor.shop_name}
                        className="flex-1"
                      />
                      <Button variant="outline" className="flex-1">
                        <Heart className="mr-2 h-4 w-4" />
                        Wishlist
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </>
                )}

                {/* Structured data JSON-LD */}
                <Script id="product-json-ld" type="application/ld+json">
                  {JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    name: product.name,
                    image: product.images,
                    description: product.description,
                    sku: product.sku,
                    brand: {
                      '@type': 'Brand',
                      name: product.vendor.shop_name,
                    },
                    offers: {
                      '@type': 'Offer',
                      url: typeof window !== 'undefined' ? window.location.href : '',
                      priceCurrency: currency.code,
                      price: product.price,
                      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                      seller: {
                        '@type': 'Organization',
                        name: product.vendor.shop_name,
                      },
                    },
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: product.rating,
                      reviewCount: product.review_count,
                    },
                  })}
                </Script>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
