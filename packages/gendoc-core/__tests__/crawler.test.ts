import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { Crawler } from '../src/crawler.js';
import { Renderer } from '../src/renderer.js';
import type { AddressInfo } from 'node:net';

describe('Crawler', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/page-1') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Page 1</h1></body></html>');
      } else if (req.url === '/page-2') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Page 2</h1></body></html>');
      } else if (req.url === '/fail') {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => { server.close(); });

  it('crawls multiple URLs with concurrency and returns pages + errors', async () => {
    const renderer = new Renderer({ timeout: 5000, retries: 0 });
    const crawler = new Crawler(renderer);
    const urls = [`${baseUrl}/page-1`, `${baseUrl}/page-2`, `${baseUrl}/fail`];
    const result = await crawler.crawl(urls, { concurrency: 2, delay: 0 });

    expect(result.pages).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('500');
    const titles = result.pages.map(p => p.$('h1').text());
    expect(titles).toContain('Page 1');
    expect(titles).toContain('Page 2');
  });
});
