'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { MessageSquare } from 'lucide-react';

interface MessageVendorButtonProps {
  vendorUserId: string;
  vendorName?: string;
  productId?: string;
  className?: string;
}

export function MessageVendorButton({
  vendorUserId,
  vendorName,
  productId,
  className,
}: MessageVendorButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleMessageClick = () => {
    // Check if user is logged in
    if (!user) {
      router.push('/login');
      return;
    }

    // Prevent self-messaging
    if (user.id === vendorUserId) {
      alert('You cannot message yourself');
      return;
    }

    const query = new URLSearchParams({ to: vendorUserId });
    if (productId) query.set('product', productId);
    setIsLoading(true);
    router.push(`/messages?${query}`);
  };

  return (
    <Button
      onClick={handleMessageClick}
      disabled={isLoading}
      className={`flex items-center gap-2 ${className || ''}`}
      variant="outline"
    >
      <MessageSquare className="h-4 w-4" />
      Message {vendorName || 'Vendor'}
    </Button>
  );
}
