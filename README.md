# ASVRI Node.js SDK

ASVRI's API for Node.js. Take payments with every gateway you've connected to ASVRI (cards, bank transfer, USSD, mobile money): create a checkout session on your server, send the customer to it, and confirm the payment with ASVRI or its signed webhook. Refund through the gateway that took the payment.

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

Reads, session creates (each has an idempotency key; one is made for you) and webhook endpoint creates are retried twice on a dropped connection, a 429 or a 5xx. **Refunds and expire are never retried**, so nothing happens twice: after a `ConnectionError`, retrieve the session to see where it stands.

```js
new Asvri(key, { timeout: 30, maxRetries: 2 })   // seconds; extra tries
```

## Links

- API reference: https://www.asvri.com/developers/docs
- Try every call in your browser: https://www.asvri.com/api-playground
- PHP SDK: https://github.com/asvri/asvri-php

MIT licence.
