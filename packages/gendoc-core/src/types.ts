import type { CheerioAPI } from 'cheerio';

/** 插件向引擎暴露的接口 */
export interface FrameworkPlugin {
  name: string;
  version: string;

  /** 检测当前页面是否属于该框架，返回检测结果或 null */
  detect(page: PageContext): Promise<DetectionResult | null>;

  /** 提取主导航/侧边栏结构 */
  getNavTree(page: PageContext): Promise<NavNode[]>;

  /** 提取正文内容为 Markdown */
  extractContent(page: PageContext): Promise<ExtractedPage>;
}

/** 引擎传递给插件的页面上下文 */
export interface PageContext {
  url: string;
  html: string;
  $: CheerioAPI;
}

/** 框架检测结果 */
export interface DetectionResult {
  framework: string;
  confidence: number;
  version?: string;
}

/** 导航节点（递归结构） */
export interface NavNode {
  title: string;
  path: string;
  children?: NavNode[];
}

/** 提取后的单页内容 */
export interface ExtractedPage {
  url: string;
  title: string;
  markdown: string;
  frontmatter?: Record<string, unknown>;
}

/** Pipeline 运行选项 */
export interface PipelineOptions {
  output: string;
  concurrency: number;
  delay: number;
  timeout: number;
  maxPages: number;
  depth: number;
  include?: string;
  exclude?: string;
  flat: boolean;
  verbose: boolean;
  framework?: string;       // 强制指定框架名，跳过检测
}

/** Pipeline 运行结果 */
export interface PipelineResult {
  totalPages: number;
  successful: number;
  failed: number;
  errors: CrawlError[];
  output: string;
  duration: number;
  framework: string;
}

/** 单页抓取错误 */
export interface CrawlError {
  url: string;
  reason: string;
  statusCode?: number;
}

/** 插件导出的工厂/实例 */
export type PluginModule = FrameworkPlugin;
