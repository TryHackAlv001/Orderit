'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { DEFAULT_CURRENCY, formatCurrency } from '@/constants';
import { ORDER_STATUS_LABELS } from '@/constants/order-status';
import type {
  MessageOrderContext,
  MessageProductContext,
  MessageProductSnapshot,
} from '@/types';

function allowedStorageImage(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const configuredHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && parsed.hostname === configuredHost
      && parsed.pathname.startsWith('/storage/v1/object/public/');
  } catch {
    return false;
  }
}

function Thumbnail({ src }: { src?: string | null }) {
  if (!allowedStorageImage(src)) {
    return <div className="h-12 w-12 shrink-0 rounded-lg bg-surface-raised" aria-hidden="true" />;
  }
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
      <Image src={src} alt="" fill unoptimized sizes="48px" className="object-cover" />
    </div>
  );
}

interface ProductContextCardProps {
  productId: string | null;
  product: MessageProductContext | null;
  snapshot: MessageProductSnapshot | null;
  removable?: boolean;
  onRemove?: () => void;
}

export function ProductContextCard({
  productId,
  product,
  snapshot,
  removable = false,
  onRemove,
}: ProductContextCardProps) {
  if (productId) {
    const available = Boolean(product?.is_active);
    const image = product?.images[0];
    return (
      <div className={`flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface px-2 py-1.5 ${
        available ? '' : 'text-muted'
      }`}>
        <Thumbnail src={available ? image : null} />
        <div className="min-w-0 flex-1">
          {!available && <p className="text-xs text-muted">This product is no longer available</p>}
          <p className="truncate text-sm font-medium text-text">
            {product?.name ?? 'Product'}
          </p>
          {available && product?.price !== null && product?.price !== undefined && (
            <p className="text-xs text-muted">{formatCurrency(product.price, DEFAULT_CURRENCY)}</p>
          )}
        </div>
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove product context"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  if (!snapshot) return null;
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface-raised px-2 py-1.5 text-muted">
      <Thumbnail src={snapshot.image_url} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">This product is no longer available</p>
        <p className="truncate text-sm font-medium text-text">{snapshot.name}</p>
        <p className="text-xs text-muted">
          Price when sent: {formatCurrency(snapshot.price_kobo / 100, DEFAULT_CURRENCY)}
        </p>
      </div>
    </div>
  );
}

interface OrderContextCardProps {
  order: MessageOrderContext;
  currentUserId: string;
  removable?: boolean;
  onRemove?: () => void;
}

export function OrderContextCard({
  order,
  currentUserId,
  removable = false,
  onRemove,
}: OrderContextCardProps) {
  const href = order.buyer_id === currentUserId
    ? `/buyer/orders/${encodeURIComponent(order.id)}`
    : `/vendor/orders/${encodeURIComponent(order.id)}`;
  const status = ORDER_STATUS_LABELS[order.status] ?? 'Order updated';
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface px-2 py-1.5">
      <Thumbnail src={order.first_item?.product_image} />
      <Link href={href} className="min-w-0 flex-1" aria-label="View order">
        <p className="truncate text-sm font-medium text-text">
          Order #{order.id.slice(0, 8)}
        </p>
        <p className="truncate text-xs text-muted">
          {status}{order.first_item ? ` · ${order.first_item.product_name}` : ''}
        </p>
      </Link>
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove order context"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function MessageProductCard({
  productId,
  product,
  snapshot,
}: Omit<ProductContextCardProps, 'removable' | 'onRemove'>) {
  if (productId) {
    return (
      <div className="mb-2">
        {product?.is_active ? (
          <Link href={`/product/${encodeURIComponent(productId)}`} className="block">
            <ProductContextCard productId={productId} product={product} snapshot={null} />
          </Link>
        ) : (
          <ProductContextCard productId={productId} product={product} snapshot={null} />
        )}
      </div>
    );
  }
  if (!snapshot) return null;
  return (
    <div className="mb-2">
      <ProductContextCard productId={null} product={null} snapshot={snapshot} />
    </div>
  );
}

export function MessageOrderCard({
  order,
  currentUserId,
}: {
  order: MessageOrderContext;
  currentUserId: string;
}) {
  return (
    <div className="mb-2">
      <OrderContextCard order={order} currentUserId={currentUserId} />
    </div>
  );
}
