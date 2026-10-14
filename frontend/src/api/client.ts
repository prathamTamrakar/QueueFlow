import { Job, QueueStats, DLQRecord } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'queueflow-admin-secret-key-123';

export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.json();
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // fallback to statusText
      }
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return json;
  }

  public static async getStats(): Promise<QueueStats> {
    const res = await this.request<{ success: boolean; data: QueueStats }>('/api/queues/stats');
    return res.data;
  }

  public static async getJobs(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  } = {}): Promise<{ jobs: Job[]; total: number; page: number; limit: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.type) searchParams.set('type', params.type);
    if (params.search) searchParams.set('search', params.search);

    const res = await this.request<{
      success: boolean;
      data: Job[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/jobs?${searchParams.toString()}`);

    return {
      jobs: res.data,
      total: res.meta.total,
      page: res.meta.page,
      limit: res.meta.limit,
      totalPages: res.meta.totalPages,
    };
  }

  public static async getJobById(id: string): Promise<Job> {
    const res = await this.request<{ success: boolean; data: Job }>(`/api/jobs/${id}`);
    return res.data;
  }

  public static async enqueueJob(
    jobData: {
      type: string;
      payload: Record<string, any>;
      priority?: number;
      maxAttempts?: number;
      backoffDelayMs?: number;
      delayMs?: number;
    },
    idempotencyKey?: string
  ): Promise<{ job: Job; cached?: boolean }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await this.request<{ success: boolean; cached?: boolean; data: Job }>(
      '/api/jobs',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(jobData),
      }
    );

    return { job: res.data, cached: res.cached };
  }

  public static async cancelJob(id: string): Promise<Job> {
    const res = await this.request<{ success: boolean; data: Job }>(`/api/jobs/${id}/cancel`, {
      method: 'POST',
    });
    return res.data;
  }

  public static async getFailedDLQJobs(params: {
    page?: number;
    limit?: number;
    isResolved?: boolean;
  } = {}): Promise<{ records: DLQRecord[]; total: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.isResolved !== undefined) searchParams.set('isResolved', params.isResolved.toString());

    const res = await this.request<{
      success: boolean;
      data: DLQRecord[];
      meta: { total: number; totalPages: number };
    }>(`/api/admin/jobs/failed?${searchParams.toString()}`, {
      headers: {
        'x-admin-key': ADMIN_KEY,
      },
    });

    return {
      records: res.data,
      total: res.meta.total,
      totalPages: res.meta.totalPages,
    };
  }

  public static async replayDLQJob(
    jobId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await this.request<{ success: boolean; data: { success: boolean; message: string } }>(
      `/api/admin/jobs/${jobId}/replay`,
      {
        method: 'POST',
        headers: {
          'x-admin-key': ADMIN_KEY,
        },
        body: JSON.stringify({ reason: reason || 'Manual dashboard replay triggered' }),
      }
    );

    return res.data;
  }
}
