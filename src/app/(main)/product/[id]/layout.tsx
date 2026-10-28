import { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Product } from '@/types';

interface ProductPageProps {
  params: {
    id: string;
  };
}

interface ProductWithVendor extends Product {
  vendor: {
    id: string;
    shop_name: string;
    rating: number;
    total_sales: number;
    created_at: string;
    is_verified: boolean;
  };
  category: {
    name: string;
  };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .eq('is_active', true)
      .single();

    if (!product) {
      return {
        title: 'Product Not Found',
        description: 'This product could not be found.',
      };
    }

    // Fetch vendor and category separately
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('shop_name')
      .eq('user_id', product.vendor_id)
      .single();

    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', product.category_id)
      .single();

    const productData = {
      ...product,
      vendor: vendor || { shop_name: '' },
      category: category || { name: '' },
    } as ProductWithVendor;
    return {
      title: `${productData.name} | Tradeloft`,
      description: productData.description?.substring(0, 160) || `Buy ${productData.name} from ${productData.vendor.shop_name}`,
      openGraph: {
        title: productData.name,
        description: productData.description?.substring(0, 160) || `Order ${productData.name}`,
        images: productData.images.length > 0 ? [productData.images[0]] : [],
        type: 'website',
      },
      keywords: [
        productData.name,
        productData.category?.name,
        productData.vendor.shop_name,
        'buy',
        'marketplace',
      ],
    };
  } catch {
    return {
      title: 'Product',
      description: 'View product details',
    };
  }
}

export const dynamic = 'force-dynamic';

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
