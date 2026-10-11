import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StorefrontHeader } from '@/components/layout/StorefrontHeader';
import ClientSideProductGrid from '@/components/vendor/ClientSideProductGrid';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Package, Star, MapPin, Phone, Mail, Clock, Search, Filter } from 'lucide-react';
import type { Product, VendorProfile, Category } from '@/types';

interface VendorStorePageProps {
  params: {
    vendorId: string;
  };
}

interface VendorWithStats extends Omit<VendorProfile, 'created_at'> {
  user_id: string;
  total_products: number;
  total_sales: number;
  rating: number;
  review_count: number;
  location?: string;
  phone?: string;
  created_at: string;
  is_verified: boolean;
}

interface ProductWithCategory extends Product {
  category: {
    name: string;
  };
}

export async function generateMetadata({ params }: VendorStorePageProps): Promise<Metadata> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('shop_name, shop_description')
      .eq('id', params.vendorId)
      .single();

    if (!vendor) {
      return {
        title: 'Store Not Found',
      };
    }

    return {
      title: `${vendor.shop_name} | Tradeloft`,
      description: vendor.shop_description || `Shop at ${vendor.shop_name} on Tradeloft`,
    };
  } catch {
    return {
      title: 'Vendor Store',
      description: 'Browse products from this vendor',
    };
  }
}

export async function generateStaticParams() {
  try {
    const supabase = createSupabaseServerClient();

    // Get top 50 vendors for ISR
    const { data: vendors } = await supabase
      .from('vendor_profiles')
      .select('id')
      .order('total_sales', { ascending: false })
      .limit(50);

    if (!vendors) return [];

    return vendors.map((vendor) => ({
      vendorId: vendor.id,
    }));
  } catch {
    return [];
  }
}

export const revalidate = 3600; // ISR: revalidate every hour

async function getVendorData(vendorId: string) {
  const supabase = createSupabaseServerClient();

  const { data: vendor, error: vendorError } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    return null;
  }

  // Get vendor stats
  const { data: products } = await supabase
    .from('products')
    .select('id, rating, review_count')
    .eq('vendor_id', vendor.user_id)
    .eq('is_active', true);

  const totalProducts = products?.length || 0;
  const totalSales = vendor.total_sales || 0;
  const avgRating = products && products.length > 0
    ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
    : 0;
  const totalReviews = products?.reduce((sum, p) => sum + p.review_count, 0) || 0;

  return {
    ...vendor,
    total_products: totalProducts,
    total_sales: totalSales,
    rating: avgRating,
    review_count: totalReviews,
  } as VendorWithStats;
}

async function getVendorProducts(vendorId: string, search?: string, categoryFilter?: string, includeInactive = false) {
  const supabase = createSupabaseServerClient();

  // If categoryFilter provided and is a name, resolve to id
  let categoryId: string | undefined = undefined;
  if (categoryFilter) {
    // crude check: UUID contains dashes
    if (categoryFilter.includes('-')) {
      categoryId = categoryFilter;
    } else {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('name', categoryFilter)
        .single();
      if (cat) categoryId = cat.id;
    }
  }

  let query = supabase
    .from('products')
    .select('*, category:categories(id,name)')
    .eq('vendor_id', vendorId);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data: products } = await query.order('created_at', { ascending: false });

  if (!products || products.length === 0) return [];

  return products as ProductWithCategory[] || [];
}

async function getVendorCategories(vendorId: string) {
  const supabase = createSupabaseServerClient();

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id,name,slug,products!inner(id)')
    .eq('products.vendor_id', vendorId)
    .eq('products.is_active', true);

  if (error) {
    throw error;
  }

  return (categories || []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    _count: { products: category.products.length },
  }));
}

export default async function VendorStorePage({ params }: VendorStorePageProps) {
  const vendor = await getVendorData(params.vendorId);

  if (!vendor) {
    notFound();
  }

  // determine if current user is the owner of this store
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id;

  let isOwner = false;
  if (currentUserId) {
    const { data: ownerProfile } = await supabase
      .from('vendor_profiles')
      .select('id,user_id')
      .eq('user_id', currentUserId)
      .single();

    if (ownerProfile && ownerProfile.id === params.vendorId) {
      isOwner = true;
    }
  }

  const products = await getVendorProducts(vendor.user_id, undefined, undefined, isOwner);
  const categories = await getVendorCategories(vendor.user_id);

  // Ensure products have vendor name for ProductCard
  const productsWithVendor = products.map((p: any) => ({
    ...p,
    vendor: { full_name: vendor.shop_name },
  }));

  return (
    <div className="space-y-8">
      {/* Storefront Header */}
      <StorefrontHeader vendor={vendor} isOwner={isOwner} />

      {isOwner && (
        <div>
          {/* owner controls */}
          {/* Client-side controls will be mounted below alongside product grid */}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-8 overflow-x-auto">
          {['products', 'categories', 'about'].map((tab) => (
            <button
              key={tab}
              className={`border-b-2 px-4 py-4 font-medium capitalize transition whitespace-nowrap ${
                tab === 'products'
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab === 'products' ? 'All Products' : tab === 'categories' ? 'Categories' : 'About'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {/* Products Tab */}
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Search products..."
                  className="w-80 pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
            <p className="text-sm text-muted">
              {products.length} product{products.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* Products Grid */}
          {/* We'll render a client-side grid so owner can toggle public/owner view */}
          {products.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="mx-auto h-16 w-16 text-muted" />
              <h3 className="mt-4 text-xl font-semibold text-text">No products yet</h3>
              <p className="mt-2 text-muted">
                This vendor hasn't added any products to their store yet.
              </p>
            </div>
          ) : (
            <div>
              {/* Client-side product grid and owner controls */}
              <ClientSideProductGrid vendorId={params.vendorId} products={productsWithVendor} isOwner={isOwner} vendorName={vendor.shop_name} categories={categories} />
            </div>
          )}
        </div>

        {/* Categories Tab */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-text">Product Categories</h2>
          {categories.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted" />
              <p className="mt-4 text-muted">No categories available yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-lg border border-border p-6 hover:border-accent transition"
                >
                  <h3 className="font-semibold text-text">{category.name}</h3>
                  <p className="mt-2 text-sm text-muted">
                    {category._count?.products || 0} products
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* About Tab */}
        <div className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Shop Description */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-text">About {vendor.shop_name}</h2>
              <div className="prose prose-sm max-w-none text-text">
                {vendor.shop_description ? (
                  <p>{vendor.shop_description}</p>
                ) : (
                  <p>
                    Welcome to {vendor.shop_name}! We are committed to providing quality products
                    and excellent customer service. Browse our collection of carefully selected items.
                  </p>
                )}
              </div>
            </div>

            {/* Contact & Policies */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-text mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {vendor.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted" />
                      <span className="text-text">{vendor.location}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted" />
                      <span className="text-text">{vendor.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted" />
                    <span className="text-text">Contact via message</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-text mb-4">Store Policies</h3>
                <div className="space-y-3 text-sm text-text">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted" />
                    <div>
                      <p className="font-medium">Processing Time</p>
                      <p>Orders processed within 1-2 business days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted" />
                    <div>
                      <p className="font-medium">Shipping</p>
                      <p>Free shipping on orders over ₦50,000</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-muted" />
                    <div>
                      <p className="font-medium">Returns</p>
                      <p>30-day return policy on all items</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}