import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {Markdown} from '../web/src/Markdown.js';

const render = (text:string) => renderToStaticMarkup(createElement(Markdown, {text}));

describe('strategy note links', () => {
  it.each([
    ['https://www.youtube.com/watch?v=example&t=30', 'https://www.youtube.com/watch?v=example&amp;t=30'],
    ['Watch https://youtu.be/example?t=30.', 'https://youtu.be/example?t=30'],
    ['www.youtube.com/watch?v=example', 'http://www.youtube.com/watch?v=example'],
    ['<https://youtu.be/example>', 'https://youtu.be/example'],
    ['[Watch lineup](https://youtu.be/example)', 'https://youtu.be/example'],
  ])('renders clickable links in %s', (text, href) => {
    expect(render(text)).toContain(`<a href="${href}" target="_blank" rel="noopener noreferrer">`);
  });

  it('does not linkify code or allow executable links and raw HTML', () => {
    expect(render('`https://youtu.be/example`')).not.toContain('<a ');
    expect(render('[Unsafe](javascript:alert%281%29)')).not.toContain('href="javascript:');
    expect(render('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
