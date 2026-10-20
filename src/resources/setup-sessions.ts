import { randomUUID } from "node:crypto"
import type { HttpClient } from "../http.js"
import type { List, SetupSession, SetupSessionCreateParams, SetupSessionListParams } from "../types.js"

/**
 * Cards on file, step one: a customer saves a card (or wallet) now, with nothing paid, to be charged later with
 * asvri.charges. Open the session's url, or embed it in your page with asvri.js and its client_secret.
 */
export class SetupSessions {
  constructor(private readonly http: HttpClient) {}

  /**
   * A setup session for a customer (matched to yours by email). The same idempotencyKey returns the same session
   * (a retry, a double click) instead of a second one; one is made for you when left out, so this call is safely
   * retried.
   */
  create(params: SetupSessionCreateParams, options: { idempotencyKey?: string } = {}): Promise<SetupSession> {
    const idempotencyKey = options.idempotencyKey ?? `asvri-node-${randomUUID()}`
    return this.http.request({ method: "POST", path: "setup_sessions", body: params, idempotencyKey, retryable: true })
  }

  /** One session as ASVRI has it now. Once "completed", payment_method is the saved card (pm_…) to charge. */
  retrieve(id: string): Promise<SetupSession> {
    return this.http.request({ method: "GET", path: "setup_sessions", query: { id }, retryable: true })
  }

  /** Sessions made with this key's mode, newest first. */
  list(params: SetupSessionListParams = {}): Promise<List<SetupSession>> {
    return this.http.request({ method: "GET", path: "setup_sessions", query: { ...params }, retryable: true })
  }

  /**
   * Close an open session so the card can no longer be saved through it. Not retried: after a ConnectionError,
   * retrieve() the session instead.
   */
  cancel(id: string): Promise<SetupSession> {
    return this.http.request({ method: "POST", path: "setup_sessions", query: { id, action: "cancel" } })
  }
}
