import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/lib/supabase-admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdminClient.auth.getUser(
    authHeader.substring(7),
  );
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const otherUserId = params.get('to');
  const productId = params.get('product');
  const orderId = params.get('order');
  if (!otherUserId || !UUID_PATTERN.test(otherUserId) || otherUserId === user.id) {
    return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
  }

  try {
    const [priorMessage, sharedOrder, product] = await Promise.all([
      supabaseAdminClient
        .from('messages')
        .select('id')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .limit(1),
      orderId && UUID_PATTERN.test(orderId)
        ? supabaseAdminClient
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .or(`and(buyer_id.eq.${user.id},vendor_id.eq.${otherUserId}),and(vendor_id.eq.${user.id},buyer_id.eq.${otherUserId})`)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      productId && UUID_PATTERN.test(productId)
        ? supabaseAdminClient
          .from('products')
          .select('id')
          .eq('id', productId)
          .eq('vendor_id', otherUserId)
          .eq('is_active', true)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (priorMessage.error || sharedOrder.error || product.error) {
      console.error(
        'Unable to verify messaging partner:',
        priorMessage.error?.message ?? sharedOrder.error?.message ?? product.error?.message,
      );
      return NextResponse.json({ error: 'Unable to load conversation partner' }, { status: 500 });
    }

    const canViewPartner = Boolean(priorMessage.data?.length || sharedOrder.data || product.data);
    if (!canViewPartner) return NextResponse.json({ partner: null });

    const { data: partner, error: partnerError } = await supabaseAdminClient
      .from('users')
      .select('id,full_name,avatar_url,role,vendor_profiles(user_id,shop_name,logo_url)')
      .eq('id', otherUserId)
      .maybeSingle();
    if (partnerError) {
      console.error('Unable to load conversation partner profile:', partnerError.message);
      return NextResponse.json({ error: 'Unable to load conversation partner' }, { status: 500 });
    }

    return NextResponse.json({ partner });
  } catch (error) {
    console.error('Error in messaging partner API:', error);
    return NextResponse.json({ error: 'Unable to load conversation partner' }, { status: 500 });
  }
}
