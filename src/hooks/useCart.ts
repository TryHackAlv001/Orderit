import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';

export function useCart() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function syncCart() {
      if (!user) return;
      
      setLoading(true);
      try {
        // Fetch cart items joined with products and vendor_profiles info
        const { data, error } = await supabase
          .from('cart_items')
          .select('*, product:products(id,name,price,images,stock_quantity,vendor_id,category_id,size_type,available_sizes,category:categories(id,name,slug)), vendor:vendor_profiles(id,shop_name)')
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          // Access current items from the store state
          const currentItems = useCartStore.getState().items;

          const dbItems: Array<{
            id: string;
            product: any;
            quantity: number;
            selected_size: string | null;
            vendor: any;
          }> = data.filter((item: any) => item.product).map((item: any) => ({
            id: `${item.product_id}::${item.selected_size ?? "default"}`,
            product: item.product,
            quantity: item.quantity,
            selected_size: item.selected_size ?? null,
            vendor: item.vendor,
          }));

          const localItems = [...currentItems];
          const mergedItems = [...dbItems];
          localItems.forEach(localItem => {
            const existsInDb = dbItems.find(dbItem =>
              dbItem.product.id === localItem.product.id &&
              (dbItem.selected_size ?? null) === (localItem.selected_size ?? null)
            );
            if (!existsInDb) {
              mergedItems.push({
                ...localItem,
                selected_size: localItem.selected_size ?? null,
              });
            }
          });

          // Update the store's items using the built-in setState
          useCartStore.setState({ items: mergedItems });
        }
      } catch (err) {
        console.error('Error fetching cart from database:', err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      syncCart();
    }
  }, [user, supabase]);

  return { loading };
}