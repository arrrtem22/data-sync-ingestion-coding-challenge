import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiStreamReader } from '../src/app/api-stream-reader';

// Mock fetch globally
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('ApiStreamReader', () => {
    let reader: ApiStreamReader;

    beforeEach(() => {
        reader = new ApiStreamReader();
        vi.resetAllMocks();
        
        // Mock token response (first call)
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                streamAccess: {
                    token: 'test-token',
                    endpoint: 'http://test-api',
                    expiresIn: 3600
                }
            })
        });
    });

    it('should fetch page', async () => {
        // Mock batch response (second call)
        globalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                data: [{ id: '1' }],
                nextCursor: 'next-cursor',
                hasMore: true
            })
        });

        const batch = await reader.fetchChunk(null);
        expect(batch.events).toHaveLength(1);
        expect(batch.cursor).toBe('next-cursor');
    });
});
