import type { HttpClient } from "../http.js"
import type { DeletedObject, List, WebhookEndpoint, WebhookEndpointCreateParams } from "../types.js"

export class WebhookEndpoints {
  constructor(private readonly http: HttpClient) {}

  /**
   * Register an HTTPS endpoint. Keep the returned secret (whsec_…) to verify events. Registering the same URL again
   * returns the existing endpoint (created: false), so this is safe to call on every deploy.
   */
  create(params: WebhookEndpointCreateParams): Promise<WebhookEndpoint> {
    return this.http.request({ method: "POST", path: "webhooks", body: params, retryable: true })
  }

  list(): Promise<List<WebhookEndpoint>> {
    return this.http.request({ method: "GET", path: "webhooks", retryable: true })
  }

  delete(id: string): Promise<DeletedObject> {
    return this.http.request({ method: "DELETE", path: "webhooks", query: { id } })
  }
}
