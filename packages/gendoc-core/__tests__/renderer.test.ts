import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { Renderer } from '../src/renderer.js';
import type { AddressInfo } from 'node:net';

describe('Renderer', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><title>Test</title></head><body><main><h1>Hello</h1><p>World</p></main></body></html>`);
      } else if (req.url === '/timeout') {
        // never respond — triggers timeout
      } else if (req.url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
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

  it('fetches a page and returns PageContext with cheerio', async () => {
    const renderer = new Renderer({ timeout: 5000 });
    const ctx = await renderer.fetch(`${baseUrl}/test`);
    expect(ctx.url).toBe(`${baseUrl}/test`);
    expect(ctx.html).toContain('<h1>Hello</h1>');
    expect(ctx.$('h1').text()).toBe('Hello');
    expect(ctx.$('p').text()).toBe('World');
  });

  it('retries on failure and eventually throws', async () => {
    const renderer = new Renderer({ timeout: 1000, retries: 1 });
    await expect(renderer.fetch(`${baseUrl}/error`)).rejects.toThrow(/500/);
  });

  it('throws on timeout', async () => {
    const renderer = new Renderer({ timeout: 500, retries: 0 });
    await expect(renderer.fetch(`${baseUrl}/timeout`)).rejects.toThrow(/timeout/);
  }, 10000);
});
