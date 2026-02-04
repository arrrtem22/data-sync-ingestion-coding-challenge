import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { env } from '../config/env';
import { EventSchema, Event } from '../models/event';
import { z } from 'zod';

const ResponseSchema = z.object({
  data: z.array(EventSchema),
  pagination: z.object({
    hasMore: z.boolean().optional(),
    nextCursor: z.string().nullable().optional(),
  }),
});

export class DataSyncClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.API_BASE_URL,
      headers: {
        'X-API-Key': env.TARGET_API_KEY,
      },
      timeout: 30000,
    });

    axiosRetry(this.client, {
      retries: 5,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               error.response?.status === 502 || 
               error.response?.status === 503;
      },
    });
  }

  async getEvents(limit: number, cursor?: string): Promise<{ events: Event[]; nextCursor?: string }> {
    try {
      const params: any = { limit };
      if (cursor) params.cursor = cursor;

      const res = await this.client.get('/events', { params });
      
      const parsed = ResponseSchema.parse(res.data);
      
      return {
        events: parsed.data,
        nextCursor: parsed.pagination.nextCursor || undefined,
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw error;
      }
      // Log error details if validation fails
      if (error instanceof z.ZodError) {
         console.error('Validation Error:', JSON.stringify(error.errors, null, 2));
      }
      throw error;
    }
  }
}
