'use client';

import { useState, useEffect, useMemo } from 'react';
import { MessageVendorButton } from '@/components/messaging/MessageVendorButton';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Star, ShoppingCart, MessageSquare, Heart, Share2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, getCurrencyOption } from '@/constants';
import { useCurrencyStore } from '@/store/currencyStore';
import { useAuthStore } from '@/store/authStore';
import { useAddToCart } from '@/hooks/useAddToCart';
import { isOwnProduct } from '@/lib/is-own-product';
import { ProductReviewsSection } from '@/components/product/ProductReviewsSection';
import Script from 'next/script';
import toast from 'react-hot-toast';
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
  id: string;
  size: string | null;
  color: string | null;
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
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const currency = getCurrencyOption(useCurrencyStore((state) => state.currency));
  const addCartItem = useAddToCart();
  const { user } = useAuthStore();

  useEffect(() => {
    if (product?.id === productId) {
    }
  }, [product?.id, productId]);

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
          .select("id,size,color,stock_quantity")
          .eq("product_id", productId);
        if (variantsError) {
          console.error("Unable to load product size inventory:", variantsError.message);
          setCartError("Unable to load size availability. Please refresh and try again.");
        } else {
          setSizeVariants(variants ?? []);
        }
        setSelectedSize(null);
        setSelectedColor(null);
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
      if (sizeVariants.length > 0 && !selectedVariant) {
        setCartError("Choose an available product option before adding this product.");
        return;
      }
      if (selectedVariant && selectedVariant.stock_quantity < quantity) {
        setCartError("There is not enough stock for the selected option.");
        return;
      }
      setCartError(null);
      try {
        await addCartItem({
          id: product.id,
          product,
          quantity,
          variant_id: selectedVariant?.id ?? null,
          needs_selection: false,
          active_variant_count_at_add: activeVariants.length,
          price_at_add: Number(product.price),
          selected_size: selectedSize,
          selected_color: selectedColor,
          vendor: {
            id: product.vendor.id,
            shop_name: product.vendor.shop_name,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to add this product to your cart.";
        setCartError(message);
        toast.error(message);
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
  const isOwner = isOwnProduct(product.vendor_id, user?.id);
  const sizeConfig = getSizeConfig(product.category?.slug ?? product.category?.name);
  const requiresSize = product.size_type
    ? product.size_type !== "none"
    : sizeConfig.type !== "none";
  const availableSizes = Array.from(new Set([
    ...(product.available_sizes ?? []),
    ...sizeVariants.filter((variant) => variant.stock_quantity > 0 && (!selectedColor || variant.color === selectedColor))
      .map((variant) => variant.size).filter((size): size is string => Boolean(size)),
  ]));
  const activeVariants = sizeVariants.filter((variant) => variant.stock_quantity > 0);
  const availableColors = Array.from(new Set(
    activeVariants.map((variant) => variant.color).filter((color): color is string => Boolean(color))
  ));
  const selectedVariant = activeVariants.find((variant) =>
    (variant.size ?? null) === selectedSize &&
    (variant.color ?? null) === selectedColor
  ) ?? null;
  const sizeStockByValue = sizeVariants.reduce<Record<string, number>>((stock, variant) => {
    if (variant.size) stock[variant.size] = (stock[variant.size] ?? 0) + variant.stock_quantity;
    return stock;
  }, {});
  const selectedSizeStock = selectedVariant?.stock_quantity ??
    (selectedSize ? sizeStockByValue[selectedSize] ?? 0 : product.stock_quantity);
  const sizeGuideKey = getSizeGuideKey(product.category?.slug ?? product.category?.name);
  const sizeGuide = sizeGuideKey ? SIZE_GUIDES[sizeGuideKey] : null;
  const canAddToCart = product.stock_quantity > 0 &&
    (!requiresSize || (selectedSize !== null && selectedSizeStock >= quantity)) &&
    (sizeVariants.length === 0 || (selectedVariant !== null && selectedVariant.stock_quantity >= quantity));

  return (
    <div className="space-y-8">
      {/* Main Product Section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Image Gallery */}
        <div className="min-w-0 space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-raised">
            {product.images[mainImage] ? (
              <Image
                src={product.images[mainImage]}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className="object-cover"
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
            <div className="flex w-full max-w-full min-w-0 gap-2 overflow-x-auto">
              {product.images.map((image, idx) => (
                <button
                  key={idx}
                  onClick={() => setMainImage(idx)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-md border transition-colors duration-200 ${
                    mainImage === idx ? 'border-accent' : 'border-border'
                  } `}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="min-w-0 space-y-6">
          {/* Category Badge */}
          {product.category?.name && (
            <Badge className="w-fit border border-border bg-transparent text-muted">{product.category.name}</Badge>
          )}

          {/* Title and Vendor */}
          <div className="min-w-0">
            <h1 className="min-w-0 break-words text-3xl font-bold text-text">{product.name}</h1>
            <Link
              href={`/vendor/${product.vendor.id}`}
              className="mt-2 block min-w-0 break-words text-accent-text transition-colors duration-200 hover:text-accent-text hover:underline"
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
            <div className="flex min-w-0 flex-wrap break-words items-baseline gap-3">
              <span className="min-w-0 break-words font-display text-3xl font-bold text-accent-text md:text-4xl">
                {formatCurrency(product.price, currency.code, currency.locale)}
              </span>
              {product.compare_price && (
                <span className="shrink-0 text-base text-muted line-through md:text-lg">
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

          {(requiresSize || sizeVariants.length > 0) && !isOwner && (
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
              {availableColors.length > 0 && (
                <div>
                  <label htmlFor="product-color" className="mb-1 block text-sm font-medium text-text">Color</label>
                  <select
                    id="product-color"
                    value={selectedColor ?? ""}
                    onChange={(event) => {
                      setSelectedColor(event.target.value || null);
                      setSelectedSize(null);
                      setCartError(null);
                    }}
                    className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a color</option>
                    {availableColors.map((color) => <option key={color} value={color}>{color}</option>)}
                  </select>
                </div>
              )}
              {availableSizes.length ? (
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const sizeVariantsForSelection = activeVariants.filter((variant) =>
                      variant.size === size && (!selectedColor || variant.color === selectedColor)
                    );
                    const inStock = sizeVariants.length > 0
                      ? sizeVariantsForSelection.some((variant) => variant.stock_quantity > 0)
                      : (sizeStockByValue[size] ?? 0) > 0;
                    return (
                      <button key={size} type="button" disabled={!inStock}
                        aria-pressed={selectedSize === size}
                        onClick={() => {
                          setSelectedSize(size);
                          const selectedStock = sizeVariantsForSelection.find((variant) => variant.stock_quantity > 0)?.stock_quantity
                            ?? sizeStockByValue[size] ?? 1;
                          setQuantity((current) => Math.min(current, selectedStock));
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
              {availableColors.length > 0 && !selectedColor && (
                <p className="text-sm text-muted">Choose a color before adding this product.</p>
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

            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-6">
              <p className="text-sm text-muted">This is your listing.</p>
              <Link
                href={`/vendor/products/${product.id}/edit`}
                className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit product
              </Link>
            </div>
          )}
          <div className="flex gap-2 border-t border-border pt-4">
            {!isOwner && (
              <MessageVendorButton
                vendorUserId={product.vendor.userId}
                vendorName={product.vendor.shop_name}
                productId={product.id}
                className="flex-1"
              />
            )}
            <Button variant="outline" className="flex-1">
              <Heart className="mr-2 h-4 w-4" />
              Wishlist
            </Button>
            <Button variant="outline" className="flex-1">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {sizeGuideOpen && sizeGuide && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-background/50 p-4" role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setSizeGuideOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="size-guide-title"
            className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="size-guide-title" className="text-xl font-semibold text-text">{sizeGuide.title}</h2>
                <p className="mt-2 text-sm text-muted">{sizeGuide.note}</p>
              </div>
              <button type="button" aria-label="Close size guide" onClick={() => setSizeGuideOpen(false)}
                className="min-h-10 min-w-10 rounded-md bg-surface-raised text-lg text-text">×</button>
            </div>
            <div className="mt-5 w-full max-w-full min-w-0 overflow-x-auto">
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
        <div className="flex w-full max-w-full min-w-0 flex-nowrap gap-8 overflow-x-auto">
          {['description', 'reviews', 'vendor'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-4 font-medium capitalize transition-colors duration-200 md:px-4 ${
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
                  <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
                    <p className="text-sm text-muted">This is your listing.</p>
                    <Link
                      href={`/vendor/products/${product.id}/edit`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm text-accent-on transition-colors duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      Edit product
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
                        productId={product.id}
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
