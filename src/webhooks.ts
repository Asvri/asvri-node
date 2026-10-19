import { createHmac, timingSafeEqual } from "node:crypto"
import { SignatureVerificationError } from "./errors.js"
import type { WebhookEvent } from "./types.js"

/**
 * Events ASVRI posts to your endpoint. Verify each one with the RAW body (before any JSON parsing):
 *
 *   app.post("/asvri-webhook", express.raw({ type: "application/json" }), (req, res) => {
 *     const event = Webhooks.constructEvent(req.body, req.get("Asvri-Signature"), process.env.ASVRI_WEBHOOK_SECRET)
 *     ...
 *   })
 *
 * Header: Asvri-Signature: t=<unix time>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>. The same event can arrive
 * more than once (retries keep its id): handle each id once.
 */
export const DEFAULT_TOLERANCE = 300

type Payload = string | Buffer | Uint8Array

const toString = (p: Payload) => (typeof p === "string" ? p : Buffer.from(p).toString("utf8"))
const sign = (secret: string, t: string | number, payload: string) => createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")

/** Throws SignatureVerificationError saying why, or returns true. tolerance: seconds an event may be old (0 = no check). */
export function verifySignature(payload: Payload, header: string | null | undefined, secret: string, tolerance = DEFAULT_TOLERANCE): true {
  if (!secret) throw new SignatureVerificationError("No signing secret given.")
  if (typeof payload !== "string" && !(payload instanceof Uint8Array)) {
    throw new SignatureVerificationError("Pass the raw request body (a string or Buffer), not parsed JSON: the signature covers the exact bytes.")
  }
  let t: string | null = null
  const signatures: string[] = []
  for (const part of String(header ?? "").split(",")) {
    const i = part.indexOf("=")
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === "t") t = v
    else if (k === "v1") signatures.push(v)
  }
  if (t === null || !/^\d+$/.test(t) || signatures.length === 0) {
    throw new SignatureVerificationError("No valid Asvri-Signature header (expected t=…,v1=…).")
  }
  if (tolerance > 0 && Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > tolerance) {
    throw new SignatureVerificationError(`The event is older than the tolerance (${tolerance} s): refused as a possible replay.`)
  }
  const expected = Buffer.from(sign(secret, t, toString(payload)), "utf8")
  for (const s of signatures) {
    const given = Buffer.from(s, "utf8")
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true
  }
  throw new SignatureVerificationError("The signature does not match this endpoint's secret.")
}

/** Verify, then parse: the event, or a SignatureVerificationError. */
export function constructEvent<T = Record<string, unknown>>(payload: Payload, header: string | null | undefined, secret: string, tolerance = DEFAULT_TOLERANCE): WebhookEvent<T> {
  verifySignature(payload, header, secret, tolerance)
  let event: unknown
  try { event = JSON.parse(toString(payload)) } catch { event = null }
  if (!event || typeof event !== "object" || !("type" in event) || !("data" in event)) {
    throw new SignatureVerificationError("The signature is valid but the body is not an ASVRI event.")
  }
  return event as WebhookEvent<T>
}

/** The header ASVRI would send for a payload: for your own tests. */
export function generateTestHeader(payload: Payload, secret: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${sign(secret, timestamp, toString(payload))}`
}

export const Webhooks = { constructEvent, verifySignature, generateTestHeader, DEFAULT_TOLERANCE }
