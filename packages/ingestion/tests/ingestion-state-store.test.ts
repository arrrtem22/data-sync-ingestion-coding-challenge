import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngestionStateStore } from '../src/core/ingestion-state-store';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock config
vi.mock('../src/core/config', () => ({
    config: {
        checkpointFile: '/tmp/test.cursor'
    }
}));

describe('IngestionStateStore', () => {
    let store: IngestionStateStore;

    beforeEach(() => {
        store = new IngestionStateStore();
        vi.resetAllMocks();
    });

    it('should return null if file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(store.load()).toBeNull();
    });

    it('should save cursor', () => {
        store.save('cursor-123');
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/tmp/test.cursor',
            expect.stringContaining('"cursor":"cursor-123"')
        );
    });

    it('should load cursor', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ cursor: 'abc', updatedAt: 'now' }));
        
        const checkpoint = store.load();
        expect(checkpoint?.cursor).toBe('abc');
    });
});
