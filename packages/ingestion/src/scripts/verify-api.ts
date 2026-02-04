
import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env';

// Override env if needed or assume it's set
const API_URL = env.API_BASE_URL || 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1';
const API_KEY = env.TARGET_API_KEY || process.env.TARGET_API_KEY;

if (!API_KEY) {
  console.error('API Key is missing. Please set TARGET_API_KEY env var.');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'X-API-Key': API_KEY,
  },
  validateStatus: () => true, // Don't throw on error status
});

async function checkLimits() {
  console.log('\n--- Checking Limits ---');
  const limits = [1, 10, 100, 1000, 5000, 10000, 20000];
  
  for (const limit of limits) {
    const start = Date.now();
    let res = await client.get('/events', { params: { limit } });
    
    if (res.status === 429) {
       const retryAfter = (res.data.rateLimit?.retryAfter || res.data.rateLimit?.reset || 5) * 1000;
       console.log(`Limit: ${limit} -> Hit Rate Limit. Waiting ${retryAfter}ms...`);
       await sleep(retryAfter + 1000);
       const start2 = Date.now();
       res = await client.get('/events', { params: { limit } });
    }

    const duration = Date.now() - start;
    
    if (res.status === 200) {
      const count = res.data.data?.length;
      console.log(`Limit: ${limit} -> Status: ${res.status}, Count: ${count}, Duration: ${duration}ms`);
      if (count < limit) {
        console.log(`  -> API capped the limit to ${count}`);
      }
    } else {
      console.log(`Limit: ${limit} -> Status: ${res.status}, Error: ${JSON.stringify(res.data)}`);
    }
  }
}

async function checkPagination() {
  console.log('\n--- Checking Pagination ---');
  // Fetch page 1
  const res1 = await client.get('/events', { params: { limit: 10 } });
  if (res1.status !== 200) {
    console.error('Failed to fetch page 1');
    return;
  }
  
  const nextCursor = res1.data.nextCursor;
  const hasMore = res1.data.hasMore;
  console.log(`Page 1: hasMore=${hasMore}, nextCursor=${nextCursor ? 'PRESENT' : 'NULL'}`);
  
  if (nextCursor) {
    // Fetch page 2
    const res2 = await client.get('/events', { params: { limit: 10, cursor: nextCursor } });
    console.log(`Page 2: Status=${res2.status}, Count=${res2.data.data?.length}`);
    
    // Check overlap
    const ids1 = new Set(res1.data.data.map((e: any) => e.id));
    const ids2 = new Set(res2.data.data.map((e: any) => e.id));
    const overlap = [...ids1].filter(x => ids2.has(x));
    console.log(`Overlap between Page 1 and Page 2: ${overlap.length}`);
  }
}

async function checkOrdering() {
  console.log('\n--- Checking Ordering ---');
  let cursor = undefined;
  let lastTimestamp = 0;
  let ordered = true;
  
  for (let i = 0; i < 3; i++) {
    const apiRes: any = await client.get('/events', { params: { limit: 100, cursor } });
    if (apiRes.status !== 200) break;
    
    const events = apiRes.data.data;
    if (events.length === 0) break;
    
    // Check internal ordering
    for (const event of events) {
      const ts = new Date(event.timestamp).getTime();
      if (ts < lastTimestamp) {
        console.log(`  -> Ordering violation found! Prev: ${lastTimestamp}, Curr: ${ts}`);
        ordered = false;
      }
      lastTimestamp = ts;
    }
    
    cursor = apiRes.data.nextCursor;
    if (!cursor) break;
  }
  
  if (ordered) {
    console.log('Events appear to be ordered by timestamp (verified first 3 pages)');
  }
}

async function triggerRateLimit() {
  console.log('\n--- Triggering Rate Limits ---');
  // Fire 20 requests in parallel
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(client.get('/events', { params: { limit: 1 } }));
  }
  
  const results = await Promise.all(promises);
  const statusCodes = results.map(r => r.status);
  const counts = statusCodes.reduce((acc: any, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});
  
  console.log('Parallel requests status codes:', counts);
  
  // Check headers of a successful request and a rate-limited one
  const success = results.find(r => r.status === 200);
  if (success) {
    console.log('Success Headers:', filterHeaders(success.headers));
  }
  
  const limited = results.find(r => r.status === 429);
  if (limited) {
    console.log('Rate Limit Headers:', filterHeaders(limited.headers));
  }
}

function filterHeaders(headers: any) {
  const keys = Object.keys(headers).filter(k => k.toLowerCase().includes('rate') || k.toLowerCase().includes('limit') || k.toLowerCase().includes('remaining'));
  const res: any = {};
  keys.forEach(k => res[k] = headers[k]);
  return res;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try {
    console.log('Waiting 5s...');
    await sleep(5000);

    // Get a valid cursor first
    let validCursor: string = '';
    try {
      const res = await client.get('/events', { params: { limit: 1 } });
      validCursor = res.data.pagination.nextCursor;
      console.log('Got cursor:', validCursor);
    } catch (e) {
      console.log('Failed to get cursor');
      return;
    }

    await sleep(2000);

    console.log('--- Testing Cursor Manipulation ---');
    // Decode, modify ts to 0, encode
    const decoded = JSON.parse(Buffer.from(validCursor, 'base64').toString());
    console.log('Decoded:', decoded);
    
    decoded.ts = 0; // Try to jump to beginning
    const forgedCursor = Buffer.from(JSON.stringify(decoded)).toString('base64');
    console.log('Forged:', forgedCursor);

    try {
      const res = await client.get('/events', { params: { limit: 1, cursor: forgedCursor } });
      console.log('Forged Cursor Result Status:', res.status);
      console.log('First Event Timestamp:', res.data.data?.[0]?.timestamp);
    } catch (e: any) {
      console.log('Forged Cursor Failed:', e.response?.status, e.response?.data);
    }

  } catch (err) {
    console.error(err);
  }
}

main();
