import { describe, expect, it } from 'vitest';

import { descriptionParts } from '@/features/tasks/descriptionLinks';

describe('descriptionParts', () => {
  it('keeps text without links as it is', () => {
    expect(descriptionParts('The bins are behind the garage.')).toEqual([
      { text: 'The bins are behind the garage.' },
    ]);
  });

  it('finds web links between text', () => {
    expect(
      descriptionParts('Gift for Lumi: https://shop.example.com/p/123?size=m, size M'),
    ).toEqual([
      { text: 'Gift for Lumi: ' },
      {
        text: 'https://shop.example.com/p/123?size=m',
        href: 'https://shop.example.com/p/123?size=m',
      },
      { text: ', size M' },
    ]);
  });

  it('leaves the punctuation that ends a sentence out of the link', () => {
    expect(descriptionParts('See http://a.example/x. (Or https://b.example/y)!')).toEqual([
      { text: 'See ' },
      { text: 'http://a.example/x', href: 'http://a.example/x' },
      { text: '. (Or ' },
      { text: 'https://b.example/y', href: 'https://b.example/y' },
      { text: ')!' },
    ]);
  });

  it('keeps brackets that belong to the link', () => {
    expect(descriptionParts('https://en.example.org/wiki/Lego_(toy)')).toEqual([
      {
        text: 'https://en.example.org/wiki/Lego_(toy)',
        href: 'https://en.example.org/wiki/Lego_(toy)',
      },
    ]);
  });

  it('links an address starting with www. over https', () => {
    expect(descriptionParts('www.example.com/gift')).toEqual([
      { text: 'www.example.com/gift', href: 'https://www.example.com/gift' },
    ]);
  });

  it("doesn't link part of an email address", () => {
    expect(descriptionParts('lumi@www.example.com')).toEqual([{ text: 'lumi@www.example.com' }]);
  });

  it("doesn't link other schemes", () => {
    expect(descriptionParts('javascript:alert(1) mailto:a@example.com')).toEqual([
      { text: 'javascript:alert(1) mailto:a@example.com' },
    ]);
  });
});
