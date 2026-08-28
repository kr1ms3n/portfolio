import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const builds = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/builds' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    category: z.string(),
    status: z.enum(['concept', 'prototype', 'live']),
    year: z.number(),
    cover: z.string(),
    coverLandscapeSmall: z.string().optional(),
    coverPortrait: z.string().optional(),
    coverPortraitSmall: z.string().optional(),
    demoPath: z.string(),
    capabilities: z.array(z.string()),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
  }),
});

export const collections = { builds };
