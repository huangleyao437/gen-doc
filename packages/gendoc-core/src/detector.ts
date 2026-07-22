import type { PluginRegistry } from './plugin-registry.js';
import type { PageContext, DetectionResult } from './types.js';

export class Detector {
  constructor(private registry: PluginRegistry) {}

  async detect(page: PageContext): Promise<DetectionResult | null> {
    for (const plugin of this.registry.listAll()) {
      const result = await plugin.detect(page);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }
}
