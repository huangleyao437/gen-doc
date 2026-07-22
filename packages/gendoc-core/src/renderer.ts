import * as cheerio from 'cheerio';
import type { PageContext } from './types.js';

export interface RendererOptions {
  timeout: number;
  retries?: number;
}

export class Renderer {
  private options: Required<RendererOptions>;

  constructor(options: RendererOptions) {
    this.options = { timeout: options.timeout, retries: options.retries ?? 2 };
  }

  async fetch(url: string): Promise<PageContext> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const html = await this.doFetch(url);
        const $ = cheerio.load(html);
        return { url, html, $ };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.options.retries) {
          const delay = attempt === 0 ? 1000 : 4000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url}`);
  }

  private async doFetch(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(`timeout: request exceeded ${this.options.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
