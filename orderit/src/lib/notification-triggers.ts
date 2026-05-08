import { createNotification } from './notifications';

/**
 * Notification trigger functions to be called from API routes
 *
 * Usage examples:
 *
 * // In an order creation API route:
 * await notifyVendorNewOrder(vendorId, orderId, buyerName);
 *
 * // In an order status update API route:
 * await notifyBuyerOrderStatusChange(buyerId, orderId, 'shipped', vendorName);
 *
 * // In a message creation API route:
 * await notifyNewMessage(recipientId, senderName, conversationId, true);
 *
 * // In a review creation API route:
 * await notifyVendorNewReview(vendorId, productName, reviewerName, productId);
 */

/**
 * Trigger notification for new order received (vendor)
 */
export async function notifyVendorNewOrder(vendorId: string, orderId: string, buyerName: string) {
  await createNotification({
    userId: vendorId,
    title: 'New Order Received',
    body: `${buyerName} placed a new order with you.`,
    type: 'order',
    link: `/main/vendor/orders/${orderId}`,
  });
}

/**
 * Trigger notification for order status change (buyer)
 */
export async function notifyBuyerOrderStatusChange(
  buyerId: string,
  orderId: string,
  status: 'confirmed' | 'shipped' | 'delivered',
  vendorName: string
) {
  const statusMessages = {
    confirmed: 'confirmed your order',
    shipped: 'shipped your order',
    delivered: 'delivered your order',
  };

  await createNotification({
    userId: buyerId,
    title: 'Order Status Updated',
    body: `${vendorName} has ${statusMessages[status]}.`,
    type: 'order',
    link: `/main/orders/${orderId}`,
  });
}

/**
 * Trigger notification for new message received
 */
export async function notifyNewMessage(
  recipientId: string,
  senderName: string,
  conversationId: string,
  isOrderRelated: boolean = false
) {
  await createNotification({
    userId: recipientId,
    title: 'New Message',
    body: `You have a new message from ${senderName}${isOrderRelated ? ' about your order' : ''}.`,
    type: 'message',
    link: `/main/messages?conversation=${conversationId}`,
  });
}

/**
 * Trigger notification for new review on vendor's product
 */
export async function notifyVendorNewReview(
  vendorId: string,
  productName: string,
  reviewerName: string,
  productId: string
) {
  await createNotification({
    userId: vendorId,
    title: 'New Review Received',
    body: `${reviewerName} left a review on your product "${productName}".`,
    type: 'review',
    link: `/main/vendor/products/${productId}`,
  });
}

/**
 * Trigger notification for buyer when order is cancelled
 */
export async function notifyBuyerOrderCancelled(
  buyerId: string,
  orderId: string,
  vendorName: string,
  reason?: string
) {
  await createNotification({
    userId: buyerId,
    title: 'Order Cancelled',
    body: `${vendorName} cancelled your order${reason ? `: ${reason}` : ''}.`,
    type: 'order',
    link: `/main/orders/${orderId}`,
  });
}

/**
 * Trigger notification for vendor when order is cancelled by buyer
 */
export async function notifyVendorOrderCancelled(
  vendorId: string,
  orderId: string,
  buyerName: string,
  reason?: string
) {
  await createNotification({
    userId: vendorId,
    title: 'Order Cancelled',
    body: `${buyerName} cancelled their order${reason ? `: ${reason}` : ''}.`,
    type: 'order',
    link: `/main/vendor/orders/${orderId}`,
  });
}