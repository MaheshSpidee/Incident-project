import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('index.html', () => {
  it('includes document metadata for responsive rendering', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="UTF-8"');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('<title>Incident Command</title>');
  });
});
