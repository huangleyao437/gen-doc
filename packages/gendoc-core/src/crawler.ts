import pLimit from 'p-limit';
import type { Renderer } from './renderer.js';
import type { PageContext, CrawlError } from './types.js';

export interface CrawlOptions {
  concurrency: number;
  delay: number;
}

export class Crawler {
  constructor(private renderer: Renderer) {}

  async crawl(urls: string[], options: CrawlOptions): Promise<{ pages: PageContext[]; errors: CrawlError[] }> {
    const pages: PageContext[] = [];
    const errors: CrawlError[] = [];
    const limit = pLimit(options.concurrency);

    const tasks = urls.map((url, index) =>
      limit(async () => {
        if (index > 0 && options.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
        try {
          const page = await this.renderer.fetch(url);
          pages.push(page);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const statusMatch = message.match(/HTTP (\d+)/);
          errors.push({
            url,
            reason: message,
            statusCode: statusMatch ? parseInt(statusMatch[1]) : undefined,
          });
        }
      })
    );

    await Promise.all(tasks);
    return { pages, errors };
  }
}
