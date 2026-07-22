import type { FrameworkPlugin } from './types.js';

export class PluginRegistry {
  private plugins = new Map<string, FrameworkPlugin>();

  register(plugin: FrameworkPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  findByName(name: string): FrameworkPlugin | undefined {
    return this.plugins.get(name);
  }

  listAll(): FrameworkPlugin[] {
    return Array.from(this.plugins.values());
  }
}
