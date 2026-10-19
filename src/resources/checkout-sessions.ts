import { randomUUID } from "node:crypto"
import type { HttpClient } from "../http.js"
import type { CheckoutSession, CheckoutSessionCreateParams, CheckoutSessionListParams, List } from "../types.js"

export class CheckoutSessions {
  constructor(private readonly http: HttpClient) {}

  /**
   * A session for an amount (or line items) in one currency: send the customer to its url. The same idempotencyKey
   * returns the same session (a retry, a double click) instead of a second one; one is made for you when left out,
   * so this call is safely retried.
   */
  create(params: CheckoutSessionCreateParams, options: { idempotencyKey?: string } = {}): Promise<CheckoutSession> {
    const idempotencyKey = options.idempotencyKey ?? `asvri-node-${randomUUID()}`
    return this.http.request({ method: "POST", path: "checkout/sessions", body: params, idempotencyKey, retryable: true })
  }

  /** One session as ASVRI has it now. Confirm payment here (status "paid"), never from the redirect alone. */
  retrieve(id: string): Promise<CheckoutSession> {
    return this.http.request({ method: "GET", path: "checkout/sessions", query: { id }, retryable: true })
  }

  /** Sessions made with this key's mode, newest first. */
  list(params: CheckoutSessionListParams = {}): Promise<List<CheckoutSession>> {
    return this.http.request({ method: "GET", path: "checkout/sessions", query: { ...params }, retryable: true })
  }

  /** Every session, page after page: `for await (const s of asvri.checkoutSessions.listAll({ status: "paid" }))`. */
  async *listAll(params: Omit<CheckoutSessionListParams, "starting_after"> = {}): AsyncGenerator<CheckoutSession> {
    let after: string | undefined
    for (;;) {
      const page = await this.list({ limit: 100, ...params, starting_after: after })
      for (const s of page.data) yield s
      if (!page.has_more || page.data.length === 0) return
      after = page.data[page.data.length - 1].id
    }
  }

  /**
   * Close an open session so it can't be paid. Not retried: if the answer to a first try were lost, a retry would
   * report "already expired" (409) for a call that worked; after a ConnectionError, retrieve() the session instead.
   */
  expire(id: string): Promise<CheckoutSession> {
    return this.http.request({ method: "POST", path: "checkout/sessions", query: { id, action: "expire" } })
  }
}
