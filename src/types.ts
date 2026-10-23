/** Shapes of what ASVRI sends back. Amounts are in major units (25 = $25.00); times are Unix seconds. */

export type Mode = "test" | "live"
export type SessionStatus = "open" | "paid" | "expired"

export interface LineItem {
  name: string
  quantity?: number
  /** Price of one, in major units. */
  amount: number
}

export interface Customer {
  name?: string | null
  email?: string | null
  /** With tax "auto": where the customer is. Given, the tax is final; left out, the pay page asks. */
  address?: { country: string; state?: string; city?: string; postal_code?: string }
  /** With tax "auto": the customer's VAT number (EU reverse charge when it is valid on VIES). */
  tax_id?: string
}

/** The tax ASVRI worked out on a session that asked for it (tax "auto"). */
export interface SessionTax {
  /** "provisional" until the customer's country is settled; "final" once a payment starts. */
  status: "provisional" | "final"
  behavior: "exclusive" | "inclusive"
  /** The prices as sent. */
  subtotal: number
  /** The tax. The session's amount is subtotal + tax (exclusive) or subtotal (inclusive). */
  amount: number
  breakdown: { name: string; rate: number; taxable_amount: number; amount: number }[]
  reverse_charge: boolean
  customer_country: string | null
  customer_region: string | null
  notes: string[]
}

export interface Payment {
  id: string
  gateway: string
  gateway_name: string
  gateway_reference: string | null
  amount: number
  currency: string
  method: string | null
  fee: number | null
}

export interface CheckoutSession {
  id: string
  object: "checkout.session"
  /** Send the customer here. */
  url: string
  status: SessionStatus
  mode: Mode
  amount: number
  currency: string
  description: string | null
  reference: string | null
  customer: Customer | null
  line_items: LineItem[] | null
  /** null unless the session was created with tax "auto". */
  tax: SessionTax | null
  metadata: Record<string, string> | null
  success_url: string | null
  cancel_url: string | null
  /** Set once paid. */
  payment: Payment | null
  attempts: { gateway: string; status: string; created: number }[]
  opens: number
  created: number
  expires_at: number
  paid_at: number | null
  [key: string]: unknown
}

export interface CheckoutSessionCreateParams {
  /** Major units. Required unless line_items is sent. */
  amount?: number
  line_items?: LineItem[]
  /** Three-letter ISO code, e.g. USD, GBP, EUR, NGN. */
  currency: string
  description?: string
  /** Your own reference, e.g. an order number. */
  reference?: string
  customer?: Customer
  /** ASVRI adds ?session_id=cs_… */
  success_url?: string
  cancel_url?: string
  /** Up to 20 keys of your own, strings. */
  metadata?: Record<string, string>
  /** Gateway slugs to offer; all connected gateways when left out. */
  payment_methods?: string[]
  /** Seconds until an unpaid session expires: 300 to 604800. Default 24 hours. */
  expires_in?: number
  /** "auto": ASVRI works out the tax with your tax rules (Payment Configuration → Tax). Left out, prices are charged as sent. */
  tax?: "auto"
  /** With tax "auto": "exclusive" (amounts are before tax) or "inclusive" (amounts include it). Default: your setting. */
  tax_behavior?: "exclusive" | "inclusive"
}

export interface CheckoutSessionListParams {
  /** 1 to 100, default 10. */
  limit?: number
  /** The last id of the previous page. */
  starting_after?: string
  status?: SessionStatus
}

export interface List<T> {
  object: "list"
  data: T[]
  /** On paged lists (checkout sessions, setup sessions, payment methods, charges): more after the last one. */
  has_more?: boolean
}

export interface RefundCreateParams {
  /** A session id (cs_…). Send this or payment. */
  session?: string
  /** A payment id (txn_…, a session's payment.id). */
  payment?: string
  /** Major units; everything not refunded yet when left out. */
  amount?: number
  /** Up to 200 characters. */
  reason?: string
}

export interface Refund {
  id: string
  object: "refund"
  status: "succeeded" | "pending" | "failed"
  amount: number
  currency: string
  payment: string
  session: string | null
  message: string
  [key: string]: unknown
}

export interface WebhookEndpointCreateParams {
  /** HTTPS URL that will receive events. */
  url: string
  /** Event types to send; all when left out. */
  events?: string[]
  description?: string
}

export interface WebhookEndpoint {
  id: string
  object: "webhook_endpoint"
  url: string
  events: string[]
  description: string | null
  active: boolean
  /** The signing secret (whsec_…), returned by create: keep it to verify events. */
  secret?: string
  /** False when an endpoint for that URL already existed (it is returned as it is). */
  created?: boolean
  [key: string]: unknown
}

export interface DeletedObject {
  id: string
  object: string
  deleted: boolean
}

/* ---- Cards on file: setup sessions, saved payment methods, charges ---- */

export type SetupSessionStatus = "open" | "completed" | "expired" | "canceled"
export type PaymentMethodStatus = "active" | "unusable" | "removed"
export type ChargeStatus = "succeeded" | "failed" | "pending" | "requires_action"

/** A customer as ASVRI has them; id is null when the person is not one of your customers yet. */
export interface CustomerRef {
  id: string | null
  name: string | null
  email: string | null
}

/** A saved card or wallet (pm_…), charged later with asvri.charges. */
export interface PaymentMethod {
  id: string
  object: "payment_method"
  mode: Mode
  /** unusable: an expired card, or its gateway is disconnected or paused (problem says which). */
  status: PaymentMethodStatus
  type: string
  brand: string | null
  last4: string | null
  /** e.g. "Visa •••• 4242". */
  label: string | null
  exp_month: number | null
  exp_year: number | null
  gateway: string | null
  gateway_name: string | null
  customer: CustomerRef
  /** "setup" (a setup session) or "payment" (a checkout session with save_payment_method). */
  source: string
  metadata: Record<string, string>
  last_used_at: number | null
  last_error: string | null
  /** Why the method can't be charged right now, or null. */
  problem: string | null
  created: number
  removed_at: number | null
  [key: string]: unknown
}

/** "Add your card" without paying (ss_…). */
export interface SetupSession {
  id: string
  object: "setup_session"
  /** Open this for the customer (your page, an email, a popup)… */
  url: string
  /**
   * …or pass this to the browser for asvri.js to embed the session in your own page
   * (`Asvri.mountCardSetup("#card", { setupToken })`). A single-use token for this one add-card page, safe in the
   * browser. It is never your API key: don't put your sk_ key in a page.
   */
  setup_token: string
  /** @deprecated Use `setup_token`; this is the same value, still returned for older integrations. */
  client_secret: string
  status: SetupSessionStatus
  mode: Mode
  customer: CustomerRef
  /** The gateway the card was saved on, once chosen. */
  gateway: string | null
  /** The saved card, once completed. */
  payment_method: PaymentMethod | null
  metadata: Record<string, string>
  success_url: string | null
  cancel_url: string | null
  error: string | null
  created: number
  expires_at: number | null
  completed_at: number | null
  [key: string]: unknown
}

export interface SetupSessionCreateParams {
  /** Who the card belongs to, matched to your customer by email (one is created when new). Send this or customer_id. */
  customer?: { email: string; name?: string }
  /** An existing customer (cus_…) instead of customer.email. */
  customer_id?: string
  /** Offer one gateway only, by slug (e.g. "stripe"); every able gateway when left out. */
  gateway?: string
  /** Gateway slugs to offer. */
  payment_methods?: string[]
  /** ASVRI adds ?setup_session_id=ss_… */
  success_url?: string
  cancel_url?: string
  /** Up to 20 keys of your own, strings; copied onto the saved payment method. */
  metadata?: Record<string, string>
  /** Seconds until the session expires unused: 300 to 604800. Default 24 hours. */
  expires_in?: number
}

export interface SetupSessionListParams {
  /** 1 to 100, default 10. */
  limit?: number
  /** The last id of the previous page. */
  starting_after?: string
  status?: SetupSessionStatus
  /** A customer id (cus_…) or email. */
  customer?: string
}

export interface PaymentMethodListParams {
  /** A customer id (cus_…) or email; all customers when left out. */
  customer?: string
  /** 1 to 100, default 20. */
  limit?: number
  /** Also list methods that were removed. */
  include_removed?: boolean
}

export interface ChargePayment extends Payment {
  status: string
}

/** The bank wants the customer: send them to url (a checkout session for the same amount). */
export interface ChargeNextAction {
  type: "pay_on_session"
  url: string
  checkout_session: string
  status: string
}

/** A merchant-initiated charge on a saved method (ch_…). */
export interface Charge {
  id: string
  object: "charge"
  status: ChargeStatus
  mode: Mode
  amount: number
  currency: string
  description: string | null
  reference: string | null
  /** The saved method charged (pm_…). */
  payment_method: string | null
  payment_method_label: string | null
  customer: CustomerRef | null
  /** The transaction, once there is one; refund it with asvri.refunds.create({ payment: payment.id }). */
  payment: ChargePayment | null
  next_action: ChargeNextAction | null
  /** Why it failed, e.g. the bank's decline message. */
  error: string | null
  metadata: Record<string, string>
  created: number
  [key: string]: unknown
}

export interface ChargeCreateParams {
  /** The saved method to charge (pm_…). */
  payment_method: string
  /** Major units (49.99 = $49.99). */
  amount: number
  /** Three-letter ISO code the method's gateway can take. */
  currency: string
  /** Shown on the customer's statement where the gateway allows, and in your dashboard. */
  description?: string
  /** Your own reference, e.g. a subscription period. */
  reference?: string
  /** Up to 20 keys of your own, strings. */
  metadata?: Record<string, string>
}

export interface ChargeListParams {
  /** 1 to 100, default 10. */
  limit?: number
  /** The last id of the previous page. */
  starting_after?: string
  /** Charges on one saved method (pm_…). */
  payment_method?: string
  /** Charges of one customer (cus_… or email). */
  customer?: string
}

export type EventType =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "payment.received"
  | "payment.failed"
  | "payment.refunded"
  | "payment.disputed"
  | "payment_method.attached"
  | "payment_method.detached"
  | "charge.succeeded"
  | "charge.failed"
  | "charge.requires_action"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "invoice.cancelled"
  | "invoice.reminder_sent"
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  | "inventory.low_stock"
  | "inventory.out_of_stock"
  | "inventory.restocked"

export interface WebhookEvent<T = Record<string, unknown>> {
  /** The same on every retry of one event: use it to handle each event once. */
  id: string
  type: EventType | (string & {})
  created: number
  test: boolean
  /** One object, e.g. data.checkout_session for checkout.session.*, data.charge for charge.*, data.payment_method for payment_method.*. */
  data: T
}
