import type { FrameworkPlugin } from './types.js';
import type { PageContext, ExtractedPage } from './types.js';

export class Extractor {
  async extractAll(pages: PageContext[], plugin: FrameworkPlugin): Promise<ExtractedPage[]> {
    const results: ExtractedPage[] = [];
    for (const page of pages) {
      const extracted = await plugin.extractContent(page);
      extracted.url = page.url;
      results.push(extracted);
    }
    return results;
  }
}
