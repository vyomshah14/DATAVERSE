/**
 * Backend API Client Service for DATAVERSE.
 * Keeps all HTTP and backend network communication encapsulated.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  service: string;
  version: string;
  environment: string;
}

export class ApiClient {
  public static async checkHealth(): Promise<HealthCheckResponse> {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend health check failed with status: ${response.status}`);
    }

    return response.json() as Promise<HealthCheckResponse>;
  }
}
