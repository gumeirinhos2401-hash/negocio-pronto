import { expect, test } from 'vitest';
import { formatEuros, parseEuros } from '../../src/domain/money';
test.each([['12,50', 1250], ['12.50', 1250], ['12', 1200], ['1 200,00', 120000], ['0', 0], [' 9,9 ', 990]])
  ('parses %s', (input, cents) => expect(parseEuros(input)).toBe(cents));
test.each(['abc', '-5', '', '12,345', '1,2,3'])('rejects %s', (input) => expect(parseEuros(input)).toBeNull());
test('formats in pt-PT euros', () => expect(formatEuros(990).replace(/\s/g, ' ')).toBe('9,90 €'));
