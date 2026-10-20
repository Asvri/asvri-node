# ASVRI Node.js SDK

ASVRI's API for Node.js. Take payments with every gateway you've connected to ASVRI (cards, bank transfer, USSD, mobile money): create a checkout session on your server, send the customer to it, and confirm the payment with ASVRI or its signed webhook. Refund through the gateway that took the payment. Keep cards on file and charge them later.

Node 18 or newer. TypeScript types included. ESM and CommonJS. No dependencies.

## Install

```bash
npm install asvri
```

Or straight from GitHub: `npm install github:asvri/asvri-node`.

## Keys

Use your **secret key** (`sk_test_…` or `sk_live_…`) from ASVRI → Settings → API access, on your server only. Test keys use only test gateways, so no real money moves.

```js
import Asvri from "asvri"            // or: const { Asvri } = require("asvri")

const asvri = new Asvri(process.env.ASVRI_SECRET_KEY)
```

## Take a payment

```js
const session = await asvri.checkoutSessions.create(
  {
    amount: 25,                         // major units; or line_items: [{ name, quantity, amount }]
    currency: "USD",
    description: "Order #1042",
    reference: "1042",
    customer: { name: "Ada Obi", email: "ada@example.com" },
    success_url: "https://yourshop.com/thanks",   // ASVRI adds ?session_id=cs_…
    cancel_url: "https://yourshop.com/cart",
    metadata: { order_id: "1042" },
  },
  { idempotencyKey: "order-1042" },      // optional: one session per order, however often you retry
)

res.redirect(303, session.url)
```

When the customer comes back, **ask ASVRI**. Never trust the redirect alone:

```js
const session = await asvri.checkoutSessions.retrieve(req.query.session_id)
if (session.status === "paid") {
  // session.payment: gateway, gateway_name, gateway_reference, method, amount, fee
}
```

Other calls:

```js
await asvri.checkoutSessions.list({ status: "paid", limit: 20 })   // one page: { data, has_more }
for await (const s of asvri.checkoutSessions.listAll({ status: "paid" })) { … }  // every page
await asvri.checkoutSessions.expire(id)                            // close an open session
```

## Webhooks

Register your endpoint once and keep its signing secret. The same URL again returns the existing endpoint, so this is safe on every deploy:

```js
const endpoint = await asvri.webhookEndpoints.create({ url: "https://yourshop.com/asvri-webhook" })
// store endpoint.secret (whsec_…)
```

Verify every event against the **raw** body. With Express:

```js
import express from "express"
import { Webhooks, SignatureVerificationError } from "asvri"

app.post("/asvri-webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event
  try {
    event = Webhooks.constructEvent(req.body, req.get("Asvri-Signature"), process.env.ASVRI_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(err.message)
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.checkout_session
    // mark the order paid; handle each event.id once (retries keep the same id)
  }
  res.sendStatus(200)   // answer within 10 seconds; do slow work afterwards
})
```

In a Next.js route handler, pass `await request.text()` as the payload.

Events older than 5 minutes are refused as possible replays (`constructEvent(payload, header, secret, toleranceSeconds)`; `0` turns the check off). `Webhooks.generateTestHeader(payload, secret)` makes a valid header for your own tests.

## Cards on file

Save a customer's card now, with nothing paid, and charge it later with nobody present (subscriptions, usage billing, "pay with my saved card"). Only gateways that can keep a card without a payment take part (Stripe, PayPal and others marked "Save & charge later" in your dashboard).

**1. On your server, create a setup session:**

```js
const setup = await asvri.setupSessions.create(
  {
    customer: { email: "ada@example.com", name: "Ada Obi" },
    success_url: "https://yourshop.com/account/cards?saved=1",   // ASVRI adds ?setup_session_id=ss_…
    metadata: { account: "42" },
  },
  { idempotencyKey: "cards-42-1" },
)
```

**2. Let the customer add the card:** send them to the session's `url`, or hand its `client_secret` to the browser and embed the form in your own page with asvri.js. The gateway's own secure fields collect the card, so neither you nor ASVRI sees the number.

**3. Confirm it was saved** with `retrieve` or the `payment_method.attached` webhook, never from the redirect alone:

```js
const setup = await asvri.setupSessions.retrieve(req.query.setup_session_id)
if (setup.status === "completed") {
  const card = setup.payment_method   // { id: "pm_…", label: "Visa •••• 4242", … }: store card.id
}
```

**4. Charge it later**, always with an idempotency key so a retry can never charge twice:

```js
const charge = await asvri.charges.create(
  { payment_method: "pm_…", amount: 49.99, currency: "USD", description: "October subscription", reference: "sub-1042-oct" },
  { idempotencyKey: "sub-1042-oct" },
)
// charge.status: succeeded (charge.payment is the transaction), failed (charge.error says why),
// pending (charge.succeeded / charge.failed follows by webhook) or requires_action (the bank wants
// the customer: send them to charge.next_action.url)
```

Other calls:

```js
await asvri.paymentMethods.list({ customer: "ada@example.com" })   // a customer's saved cards
await asvri.paymentMethods.retrieve("pm_…")
await asvri.paymentMethods.detach("pm_…")                           // it can't be charged again
await asvri.charges.retrieve("ch_…")
await asvri.charges.list({ payment_method: "pm_…" })
await asvri.setupSessions.list({ status: "completed" })
await asvri.setupSessions.cancel("ss_…")
await asvri.refunds.create({ payment: charge.payment.id })          // refund a charge
```

Events: `payment_method.attached`, `payment_method.detached`, `charge.succeeded`, `charge.failed`, `charge.requires_action` (the object is in `data.payment_method` / `data.charge`).

## Refunds

```js
await asvri.refunds.create({ session: "cs_live_…", amount: 1000, reason: "Damaged item" })  // part
await asvri.refunds.create({ payment: "txn_…" })                                            // the rest
```

## Errors

Everything thrown is an `AsvriError`:

| Class | When |
| --- | --- |
| `AuthenticationError` | 401: the key is wrong, revoked or expired |
| `InvalidRequestError` | 4xx: `err.param` names the field; 404 for an unknown id; 409 when a session is already expired |
| `RateLimitError` | 429 |
| `ServerError` | 5xx |
| `ConnectionError` | no answer (network, timeout) |
| `SignatureVerificationError` | a webhook that fails its check |

API errors carry `status`, `type`, `param` and `body`.

## Retries and timeouts

Reads, session creates (each has an idempotency key; one is made for you), webhook endpoint creates and charges **with** an idempotency key are retried twice on a dropped connection, a 429 or a 5xx. **Refunds, expire, cancel and a charge without an idempotency key are never retried**, so nothing happens twice: after a `ConnectionError`, retrieve the session (or list the method's charges) to see where it stands.

```js
new Asvri(key, { timeout: 30, maxRetries: 2 })   // seconds; extra tries
```

## Links

- API reference: https://www.asvri.com/developers/docs
- Try every call in your browser: https://www.asvri.com/api-playground
- PHP SDK: https://github.com/asvri/asvri-php

MIT licence.
