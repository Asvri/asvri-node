// A complete checkout with Express: create a session, send the customer to ASVRI, confirm on return, verify webhooks.
//   ASVRI_SECRET_KEY=sk_test_… ASVRI_WEBHOOK_SECRET=whsec_… node examples/express.mjs
import express from "express"
import Asvri, { Webhooks } from "asvri"

const asvri = new Asvri(process.env.ASVRI_SECRET_KEY)
const app = express()
const BASE = process.env.BASE_URL ?? "http://localhost:3000"

app.post("/checkout", async (req, res, next) => {
  try {
    const orderId = "1042"                            // your order
    const session = await asvri.checkoutSessions.create(
      { amount: 2500, currency: "NGN", reference: orderId, success_url: `${BASE}/thanks`, cancel_url: `${BASE}/cart`, metadata: { order_id: orderId } },
      { idempotencyKey: `order-${orderId}` },
    )
    res.redirect(303, session.url)
  } catch (err) { next(err) }
})

app.get("/thanks", async (req, res, next) => {
  try {
    const session = await asvri.checkoutSessions.retrieve(String(req.query.session_id))
    res.send(session.status === "paid" ? `Paid with ${session.payment?.gateway_name}. Thank you!` : "Payment not confirmed yet.")
  } catch (err) { next(err) }
})

// raw body: the signature covers the exact bytes ASVRI sent
app.post("/asvri-webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event
  try {
    event = Webhooks.constructEvent(req.body, req.get("Asvri-Signature"), process.env.ASVRI_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(err.message)
  }
  if (event.type === "checkout.session.completed") {
    console.log("paid:", event.data.checkout_session.metadata?.order_id)
  }
  res.sendStatus(200)
})

app.listen(3000, () => console.log(`${BASE}  (POST /checkout to start)`))
