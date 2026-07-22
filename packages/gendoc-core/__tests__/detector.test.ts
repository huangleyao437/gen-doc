import { describe, it, expect, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import { PluginRegistry } from '../src/plugin-registry.js';
import { Detector } from '../src/detector.js';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage } from '../src/types.js';

function makeDetectorPlugin(name: string, shouldDetect: boolean, confidence: number): FrameworkPlugin {
  return {
    name,
    version: '1.0.0',
    detect: async (_page: PageContext): Promise<DetectionResult | null> => {
      if (!shouldDetect) return null;
      return { framework: name, confidence };
    },
    getNavTree: async (_page: PageContext): Promise<NavNode[]> => [],
    extractContent: async (_page: PageContext): Promise<ExtractedPage> => ({ url: '', title: '', markdown: '' }),
  };
}

const html = '<html><body><p>test</p></body></html>';
const $ = cheerio.load(html);
const page: PageContext = { url: 'https://example.com', html, $ };

describe('Detector', () => {
  let registry: PluginRegistry;
  let detector: Detector;

  beforeEach(() => {
    registry = new PluginRegistry();
    detector = new Detector(registry);
  });

  it('returns detection result from matching plugin', async () => {
    registry.register(makeDetectorPlugin('docusaurus', true, 0.9));
    const result = await detector.detect(page);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('docusaurus');
    expect(result!.confidence).toBe(0.9);
  });

  it('returns null when no plugin matches', async () => {
    registry.register(makeDetectorPlugin('docusaurus', false, 0));
    registry.register(makeDetectorPlugin('vitepress', false, 0));
    const result = await detector.detect(page);
    expect(result).toBeNull();
  });

  it('picks the first matching plugin by registration order', async () => {
    registry.register(makeDetectorPlugin('plugin-a', true, 0.8));
    registry.register(makeDetectorPlugin('plugin-b', true, 0.95));
    const result = await detector.detect(page);
    expect(result!.framework).toBe('plugin-a');
  });
});
