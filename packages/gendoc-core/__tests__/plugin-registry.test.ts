import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../src/plugin-registry.js';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage } from '../src/types.js';

function makeMockPlugin(name: string): FrameworkPlugin {
  return {
    name,
    version: '1.0.0',
    detect: async (_page: PageContext): Promise<DetectionResult | null> => ({ framework: name, confidence: 1.0 }),
    getNavTree: async (_page: PageContext): Promise<NavNode[]> => [],
    extractContent: async (_page: PageContext): Promise<ExtractedPage> => ({ url: '', title: '', markdown: '' }),
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('registers a plugin and retrieves by name', () => {
    const plugin = makeMockPlugin('test-plugin');
    registry.register(plugin);
    expect(registry.findByName('test-plugin')).toBe(plugin);
  });

  it('returns undefined for unknown plugin', () => {
    expect(registry.findByName('unknown')).toBeUndefined();
  });

  it('lists all registered plugins', () => {
    const p1 = makeMockPlugin('plugin-a');
    const p2 = makeMockPlugin('plugin-b');
    registry.register(p1);
    registry.register(p2);
    expect(registry.listAll()).toEqual([p1, p2]);
  });

  it('replaces plugin with same name', () => {
    const p1 = makeMockPlugin('same-name');
    const p2 = makeMockPlugin('same-name');
    registry.register(p1);
    registry.register(p2);
    expect(registry.listAll()).toHaveLength(1);
    expect(registry.findByName('same-name')).toBe(p2);
  });
});
