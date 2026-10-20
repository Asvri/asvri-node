import type { HttpClient } from "../http.js"
import type { List, PaymentMethod, PaymentMethodListParams } from "../types.js"

/** The cards and wallets your customers saved (setup sessions, or checkout sessions with save_payment_method). */
export class PaymentMethods {
  constructor(private readonly http: HttpClient) {}

  retrieve(id: string): Promise<PaymentMethod> {
    return this.http.request({ method: "GET", path: "payment_methods", query: { id }, retryable: true })
  }

  /** A customer's methods (customer: cus_… or an email), or all of them, newest first. Removed ones only with include_removed. */
  list(params: PaymentMethodListParams = {}): Promise<List<PaymentMethod>> {
    const query: Record<string, string | number | undefined> = { ...params, include_removed: params.include_removed ? "true" : undefined }
    return this.http.request({ method: "GET", path: "payment_methods", query, retryable: true })
  }

  /**
   * Remove a saved method: it can't be charged again (payment_method.detached is posted). Past charges keep their
   * records. Safe to retry: removing a removed method returns it as it is.
   */
  detach(id: string): Promise<PaymentMethod> {
    return this.http.request({ method: "DELETE", path: "payment_methods", query: { id }, retryable: true })
  }
}
