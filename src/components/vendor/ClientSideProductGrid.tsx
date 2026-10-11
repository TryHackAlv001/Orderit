'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import OwnerControls from '@/components/vendor/OwnerControls';
import ProductGridClient from '@/components/vendor/ProductGridClient';
import type { Category } from '@/types';
import type { Product } from '@/types';

interface Props {
  vendorId: string;
  products: Product[];
  isOwner?: boolean;
  vendorName?: string;
  categories?: Category[];
}

export default function ClientSideProductGrid({ vendorId, products, isOwner = false, categories = [] }: Props) {
  const [viewPublic, setViewPublic] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !activeCategory || (p.category && (p.category as any).id === activeCategory);
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex items-center justify-between">
          <OwnerControls vendorId={vendorId} onToggleView={(v) => setViewPublic(v)} />
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {categories && categories.length > 0 && (
        <div className="flex gap-3 overflow-x-auto">
          <button
            className={`rounded-full px-4 py-2 text-sm ${!activeCategory ? 'bg-accent text-accent-on' : 'bg-surface-raised text-text'}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`rounded-full px-4 py-2 text-sm ${activeCategory === c.id ? 'bg-accent text-accent-on' : 'bg-surface-raised text-text'}`}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <ProductGridClient products={filteredProducts} initialViewPublic={viewPublic} />
    </div>
  );
}
