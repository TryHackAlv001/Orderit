import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdminClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { messageIds }: { messageIds: string[] } = await request.json();

    if (!messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json({ error: 'messageIds array is required' }, { status: 400 });
    }

    const { error } = await supabaseAdminClient
      .from('messages')
      .update({ is_read: true })
      .in('id', messageIds)
      .eq('receiver_id', user.id);

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json({ error: 'Failed to mark messages as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in mark-read API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}