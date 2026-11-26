export interface PaymentRequest {
  amount: number;
  currency: string;
  customer: {
    id: string;
    name: string;
  };
}

export function validatePaymentRequest(req: PaymentRequest): boolean {
  if (req.amount <= 0) {
    throw new Error("Invalid payment amount: must be positive");
  }
  if (!req.currency || req.currency.length !== 3) {
    throw new Error("Invalid currency code: must be 3 ISO characters");
  }
  if (!req.customer || !req.customer.id) {
    throw new Error("Missing customer identifier");
  }
  return true;
}

export function processPayment(req: PaymentRequest): { success: boolean; txnId: string } {
  validatePaymentRequest(req);
  return {
    success: true,
    txnId: `txn_${Date.now()}`
  };
}
