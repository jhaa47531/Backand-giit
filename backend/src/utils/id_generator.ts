import crypto from 'crypto';

export function generateStudentId(seqNumber: number): string {
  return `STU${String(seqNumber).padStart(6, '0')}`;
}

export function generateFeeId(seqNumber: number): string {
  return `FEE${String(seqNumber).padStart(6, '0')}`;
}

export function generatePaymentId(seqNumber: number): string {
  return `PAY${String(seqNumber).padStart(6, '0')}`;
}

export function generateUserId(): string {
  return `USR_${crypto.randomBytes(6).toString('hex')}`;
}

export function generateReceiptNumber(seqNumber: number, year = new Date().getFullYear()): string {
  return `RCP-${year}-${String(seqNumber).padStart(5, '0')}`;
}

export function generateRazorpayOrderId(): string {
  return `order_${crypto.randomBytes(10).toString('hex')}`;
}
