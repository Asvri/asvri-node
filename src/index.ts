import { HttpClient, DEFAULT_API_BASE, type ClientOptions } from "./http.js"
import { CheckoutSessions } from "./resources/checkout-sessions.js"
import { Refunds } from "./resources/refunds.js"
import { WebhookEndpoints } from "./resources/webhook-endpoints.js"
import { Webhooks } from "./webhooks.js"
import type { Mode } from "./types.js"
import { VERSION } from "./version.js"

/**
 * ASVRI's API for Node.js. Keep the secret key on your server:
 *
 *   import Asvri from "asvri"
 *   const asvri = new Asvri(process.env.ASVRI_SECRET_KEY)
 *   const session = await asvri.checkoutSessions.create({ amount: 25, currency: "USD", success_url: "…" })
 */
export class Asvri {
  static readonly VERSION = VERSION
  static readonly DEFAULT_API_BASE = DEFAULT_API_BASE
  /** Webhook signature checks; also exported on their own. */
  static readonly webhooks = Webhooks

  readonly checkoutSessions: CheckoutSessions
  readonly refunds: Refunds
  readonly webhookEndpoints: WebhookEndpoints
  readonly webhooks = Webhooks
  /** "test" for sk_test_ keys, "live" for sk_live_ keys. */
  readonly mode: Mode

  constructor(secretKey: string | undefined, options: ClientOptions = {}) {
    const key = String(secretKey ?? "").trim()
    if (key.startsWith("pk_")) throw new Error("That is a publishable key. The ASVRI API needs a secret key (sk_test_… or sk_live_…), kept on your server.")
    if (!/^sk_(test|live)_[A-Za-z0-9]{16,}$/.test(key)) throw new Error("Pass your ASVRI secret key (sk_test_… or sk_live_…), from ASVRI → Settings → API access.")
    const http = new HttpClient(key, options)
    this.mode = key.startsWith("sk_test_") ? "test" : "live"
    this.checkoutSessions = new CheckoutSessions(http)
    this.refunds = new Refunds(http)
    this.webhookEndpoints = new WebhookEndpoints(http)
  }
}

export default Asvri
export type { ClientOptions } from "./http.js"
export * from "./errors.js"
export * from "./types.js"
export { Webhooks, constructEvent, verifySignature, generateTestHeader, DEFAULT_TOLERANCE } from "./webhooks.js"
