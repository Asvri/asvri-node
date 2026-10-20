import type { HttpClient } from "../http.js"
import type { Charge, ChargeCreateParams, ChargeListParams, List } from "../types.js"

/** Cards on file, step two: charge a saved payment method with nobody present (merchant-initiated). */
export class Charges {
  constructor(private readonly http: HttpClient) {}

  /**
   * Charge a saved method now, through the gateway it was saved on. The answer is final in one call: succeeded,
   * failed (error says why), pending (a webhook settles it) or requires_action (next_action.url is a payment page
   * for the customer).
   *
   * Always pass an idempotencyKey (e.g. "sub-1042-oct"): with one, ASVRI returns the same charge for the same key,
   * so the call is retried like a read. Without one the SDK never retries: a second try could charge twice.
   */
  create(params: ChargeCreateParams, options: { idempotencyKey?: string } = {}): Promise<Charge> {
    const idempotencyKey = options.idempotencyKey
    return this.http.request({ method: "POST", path: "charges", body: params, idempotencyKey, retryable: !!idempotencyKey })
  }

  /** One charge: its status, payment (once succeeded) and next_action (when the bank wants the customer). */
  retrieve(id: string): Promise<Charge> {
    return this.http.request({ method: "GET", path: "charges", query: { id }, retryable: true })
  }

  /** Charges in this key's mode, newest first; narrow to one payment_method (pm_…) or customer (cus_… or email). */
  list(params: ChargeListParams = {}): Promise<List<Charge>> {
    return this.http.request({ method: "GET", path: "charges", query: { ...params }, retryable: true })
  }
}
