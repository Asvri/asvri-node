import type { HttpClient } from "../http.js"
import type { Refund, RefundCreateParams } from "../types.js"

export class Refunds {
  constructor(private readonly http: HttpClient) {}

  /**
   * Refund a paid session (or payment) through the gateway that took it, in part (amount) or in full. Never retried:
   * a second try could refund twice. After a ConnectionError, retrieve the session to see what was refunded.
   */
  create(params: RefundCreateParams): Promise<Refund> {
    return this.http.request({ method: "POST", path: "refunds", body: params })
  }
}
