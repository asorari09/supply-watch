import { z } from "zod";

export const newsItemWireSchema = z
  .object({
    title: z.string().optional(),
    link: z.string().optional(),
    description: z.string().optional(),
    publishedAt: z.string().optional(),
    categories: z.array(z.string()).optional(),
  })
  .passthrough();

export const normalizedNewsFeedWireSchema = z
  .object({
    items: z.array(newsItemWireSchema),
  })
  .passthrough();

export type NewsItemWire = z.infer<typeof newsItemWireSchema>;
export type NormalizedNewsFeedWire = z.infer<
  typeof normalizedNewsFeedWireSchema
>;
