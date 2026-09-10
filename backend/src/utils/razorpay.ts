import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Verifies Razorpay payment signature strictly on the server side using HMAC SHA256.
 * Official Razorpay algorithm:
 * expected_signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const secret = params.secret || config.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('Razorpay secret is missing on backend');
  }

  const payload = `${params.orderId}|${params.paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timingSafeEqual to avoid timing side-channel attacks
  try {
    const a = Buffer.from(generatedSignature, 'utf8');
    const b = Buffer.from(params.signature, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Computes signature for testing or test checkout flows
 */
export function computeSignatureForTesting(orderId: string, paymentId: string, secret?: string): string {
  const keySecret = secret || config.RAZORPAY_KEY_SECRET;
  const payload = `${orderId}|${paymentId}`;
  return crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');
}
