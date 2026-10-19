/**
 * Everything the SDK throws is an AsvriError. ASVRI's own answers are ApiError subclasses (by HTTP status); a call
 * that never got an answer is ConnectionError; a webhook that fails its check is SignatureVerificationError.
 */
export class AsvriError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export interface ErrorBody {
  error?: { type?: string; message?: string; param?: string }
}

/** ASVRI answered with an error: status, type (authentication_error, invalid_request_error…), param (the field at fault). */
export class ApiError extends AsvriError {
  readonly status: number
  readonly type: string | null
  readonly param: string | null
  readonly body: unknown

  constructor(message: string, status: number, type: string | null = null, param: string | null = null, body: unknown = null) {
    super(message)
    this.status = status
    this.type = type
    this.param = param
    this.body = body
  }

  /** The right subclass for a status: 401 Authentication, 429 RateLimit, 5xx Api, other 4xx InvalidRequest. */
  static fromResponse(status: number, json: unknown, raw: string): ApiError {
    const err = (json as ErrorBody | null)?.error ?? {}
    const message = err.message ?? `ASVRI answered HTTP ${status}.${json === null && raw ? " " + raw.slice(0, 200) : ""}`
    const args = [message, status, err.type ?? null, err.param ?? null, json] as const
    if (status === 401) return new AuthenticationError(...args)
    if (status === 429) return new RateLimitError(...args)
    if (status >= 500) return new ServerError(...args)
    return new InvalidRequestError(...args)
  }
}

/** 401: the key is missing, wrong, revoked or expired. */
export class AuthenticationError extends ApiError {}
/** 4xx: something in the request (param names the field when there is one), or 404 for an unknown id. */
export class InvalidRequestError extends ApiError {}
/** 429: too many requests; wait and try again. */
export class RateLimitError extends ApiError {}
/** 5xx: a problem at ASVRI or at the gateway. */
export class ServerError extends ApiError {}

/** No answer from ASVRI (network, timeout), or an answer that wasn't JSON. */
export class ConnectionError extends AsvriError {
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

/** A webhook whose Asvri-Signature doesn't check out: forged, stale, or verified with the wrong secret. */
export class SignatureVerificationError extends AsvriError {}
