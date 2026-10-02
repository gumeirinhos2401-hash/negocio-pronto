import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Field } from '../../src/components/Field';

test('links the error and the hint to the input and marks it invalid', () => {
  render(<Field label="Nome" id="nome" value="" onChange={() => {}} hint="Aparece nos textos." error="Indique o nome do negócio." />);
  const input = screen.getByLabelText('Nome');
  const error = screen.getByRole('alert');
  expect(error).toHaveTextContent('Indique o nome do negócio.');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ');
  expect(describedBy).toContain(error.id);
  expect(describedBy).toContain(screen.getByText('Aparece nos textos.').id);
});

test('a field without an error is not marked invalid', () => {
  render(<Field label="Cidade" id="cidade" value="Braga" onChange={() => {}} />);
  const input = screen.getByLabelText('Cidade');
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(input).not.toHaveAttribute('aria-describedby');
  expect(screen.queryByRole('alert')).toBeNull();
});
