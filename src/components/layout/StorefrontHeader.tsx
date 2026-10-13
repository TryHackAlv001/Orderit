'use client';
import Image from 'next/image';
import { Star, MapPin, Calendar, Package, Heart, Share2, Clock, Edit3 } from 'lucide-react';
import { MessageVendorButton } from '@/components/messaging/MessageVendorButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { VendorProfile } from '@/types';

interface StorefrontHeaderProps {
  vendor: Omit<VendorProfile, 'created_at'> & {
    user_id: string;
    total_products: number;
    total_sales: number;
    rating: number;
    review_count: number;
    location?: string;
    phone?: string;
    created_at: string;
    is_verified: boolean;
  };
  vendorUserId?: string;
}

interface StorefrontHeaderPropsWithOwner extends StorefrontHeaderProps {
  isOwner?: boolean;
}

export function StorefrontHeader({ vendor, isOwner }: StorefrontHeaderPropsWithOwner) {
  return (
    <div className="space-y-6">
      {/* Banner Image */}
      <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border bg-surface-raised sm:h-56 md:h-80">
        {vendor.banner_url ? (
          <Image
            src={vendor.banner_url}
            alt={`${vendor.shop_name} banner`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-raised">
            <Package className="h-24 w-24 text-muted" />
          </div>
        )}
        {/* no floating owner overlay to avoid overlapping badge */}
        {vendor.is_verified && (
          <Badge className="absolute right-6 top-6 bg-accent/10 text-text">
            Open Now
          </Badge>
        )}
      </div>

      {/* Vendor Info Row */}
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-6">
          {/* Logo */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-surface-raised shadow-sm sm:h-24 sm:w-24">
            {vendor.logo_url ? (
              <Image
                src={vendor.logo_url}
                alt={`${vendor.shop_name} logo`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-accent/10 text-accent-text">
                <Package className="h-8 w-8 sm:h-12 sm:w-12" />
              </div>
            )}
            {isOwner ? (
              <a
                href="/vendor/settings#branding"
                className="absolute right-0 bottom-0 hidden translate-y-6 translate-x-6 items-center gap-2 rounded-md border border-border bg-surface p-2 text-sm text-text shadow-sm transition-colors duration-200 hover:bg-surface-raised md:flex"
                title="Edit logo"
              >
                <Edit3 className="h-4 w-4" />
              </a>
            ) : null}
          </div>

          {/* Vendor Details */}
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="break-words text-2xl font-bold text-text sm:text-3xl">{vendor.shop_name}</h1>
              {vendor.is_verified && (
                <Badge className="bg-success/10 text-text">Verified</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {vendor.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{vendor.location}</span>
                </div>
              )}

              <div className="flex min-w-0 items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="break-words">Member since {new Date(vendor.created_at).getFullYear()}</span>
              </div>

              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-accent text-accent-text" />
                <span>{vendor.rating.toFixed(1)} ({vendor.review_count} reviews)</span>
              </div>

              <div className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                <span>{vendor.total_products} menu items</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Delivery estimate 30-45 mins</span>
              </div>
            </div>

            {vendor.shop_description && (
              <p className="max-w-2xl text-text">{vendor.shop_description}</p>
            )}
          </div>
        </div>

        {/* Action Buttons: if owner show Edit/Add, else show Message/Follow. Share always visible */}
        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-wrap gap-2 sm:gap-3">
            {isOwner ? (
              <>
                <a href="/vendor/settings" className="">
                  <Button>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit Store
                  </Button>
                </a>
                <a href="/vendor/products/new">
                  <Button>
                    <Package className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </a>
              </>
            ) : (
              <>
                <MessageVendorButton 
                  vendorUserId={vendor.user_id}
                  vendorName={vendor.shop_name}
                />
                <Button variant="outline">
                  <Heart className="mr-2 h-4 w-4" />
                  Follow
                </Button>
              </>
            )}
            <Button variant="outline">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}