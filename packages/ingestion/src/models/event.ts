import { z } from 'zod';

export const EventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: z.string(),
  name: z.string(),
  properties: z.record(z.any()).optional().default({}),
  timestamp: z.union([z.number(), z.string()]).transform((val) => {
    // If it's a number, assume epoch ms
    // If string, assume ISO
    return new Date(val);
  }),
  session: z.record(z.any()).optional(),
});

export type Event = z.infer<typeof EventSchema>;

export interface IngestedEvent {
  id: string;
  user_id: string;
  session_id: string;
  type: string;
  name: string;
  properties: any;
  timestamp: Date;
}
