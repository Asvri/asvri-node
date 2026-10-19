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
  /** On paged lists (checkout sessions): more after the last one. */
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

export type EventType =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "payment.received"
  | "payment.failed"
  | "payment.refunded"
  | "payment.disputed"
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
  /** One object, e.g. data.checkout_session for checkout.session.*. */
  data: T
}
