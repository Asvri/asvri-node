import { ApiError, ConnectionError } from "./errors.js"
import { VERSION } from "./version.js"

export const DEFAULT_API_BASE = "https://api.asvri.com/app/api/v1"

export interface ClientOptions {
  /** Default https://api.asvri.com/app/api/v1. */
  apiBase?: string
  /** Added to every path (".php" for a local ASVRI); empty by default. */
  apiExt?: string
  /** Seconds before a call is given up. Default 30. */
  timeout?: number
  /** Extra tries for reads and idempotent creates after a dropped connection, a 429 or a 5xx. Default 2. */
  maxRetries?: number
  /** A fetch to use instead of the global one (tests, proxies). */
  fetch?: typeof fetch
}

export interface RequestSpec {
  method: "GET" | "POST" | "DELETE"
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  idempotencyKey?: string
  /** Safe to send again: a read, or a create with an Idempotency-Key. */
  retryable?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One call to ASVRI: JSON in, JSON out, errors thrown. Anything that could move money twice is never retried. */
export class HttpClient {
  private readonly base: string
  private readonly ext: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly key: string, options: ClientOptions = {}) {
    this.base = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "")
    this.ext = options.apiExt ?? ""
    this.timeoutMs = Math.max(1, options.timeout ?? 30) * 1000
    this.maxRetries = Math.max(0, options.maxRetries ?? 2)
    const f = options.fetch ?? globalThis.fetch
    if (typeof f !== "function") throw new Error("asvri needs fetch: use Node 18 or newer, or pass options.fetch.")
    this.fetchImpl = f
  }

  async request<T>(spec: RequestSpec): Promise<T> {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(spec.query ?? {})) if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
    const qs = params.toString()
    const url = `${this.base}/${spec.path.replace(/^\/+/, "")}${this.ext}${qs ? `?${qs}` : ""}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.key}`,
      Accept: "application/json",
      "User-Agent": `asvri-node/${VERSION} node/${typeof process !== "undefined" ? process.versions?.node ?? "?" : "?"}`,
    }
    const hasBody = spec.body !== undefined && spec.body !== null
    if (hasBody) headers["Content-Type"] = "application/json"
    if (spec.idempotencyKey) headers["Idempotency-Key"] = spec.idempotencyKey
    const payload = hasBody ? JSON.stringify(spec.body) : undefined

    for (let attempt = 1; ; attempt++) {
      let res: Response | null = null
      let failure: unknown = null
      try {
        res = await this.fetchImpl(url, { method: spec.method, headers, body: payload, signal: AbortSignal.timeout(this.timeoutMs) })
      } catch (e) {
        failure = e
      }
      const again = spec.retryable && attempt <= this.maxRetries && (res === null || res.status === 429 || res.status >= 500)
      if (again) {
        await sleep(Math.min(2000, 500 * 2 ** (attempt - 1)))
        continue
      }
      if (res === null) {
        const why = failure instanceof Error ? (failure.name === "TimeoutError" ? `no answer within ${this.timeoutMs / 1000} s` : failure.message) : String(failure)
        throw new ConnectionError(`Could not reach ASVRI: ${why}`)
      }
      const raw = await res.text()
      let json: unknown = null
      try { json = raw ? JSON.parse(raw) : null } catch { json = null }
      if (res.ok) {
        if (json === null || typeof json !== "object") throw new ConnectionError(`ASVRI answered HTTP ${res.status} with a body that isn't JSON.`, res.status)
        return json as T
      }
      throw ApiError.fromResponse(res.status, json, raw)
    }
  }
}
