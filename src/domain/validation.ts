import { parseEuros } from './money';
import type { BusinessProfile, PostInput } from './types';

export type Errors<K extends string> = Partial<Record<K, string>>;

// Only web links are accepted, so "javascript:" and other schemes never reach an href.
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const PHONE = /^\+?[\d\s()-]+$/;
const LINK_ERROR = 'O link tem de começar por https:// ou http://.';

function tooLong(value: string, max: number): string | undefined {
  return value.trim().length > max ? `Use no máximo ${max} caracteres.` : undefined;
}

function compact<K extends string>(errors: Record<K, string | undefined>): Errors<K> {
  const result: Errors<K> = {};
  for (const key of Object.keys(errors) as K[]) {
    const message = errors[key];
    if (message) result[key] = message;
  }
  return result;
}

export function validateBusiness(b: BusinessProfile): Errors<'name' | 'category' | 'city' | 'phone' | 'email' | 'bookingLink' | 'website'> {
  const phone = b.phone.trim();
  const email = b.email.trim();
  const digits = phone.replace(/\D/g, '').length;
  return compact({
    name: b.name.trim() ? tooLong(b.name, 80) : 'Indique o nome do negócio.',
    category: tooLong(b.category, 60),
    city: tooLong(b.city, 60),
    phone: phone && (!PHONE.test(phone) || digits < 9 || digits > 15)
      ? 'Este número não parece válido. Escreva, por exemplo, 912 345 678.' : undefined,
    email: email && !EMAIL.test(email) ? 'Este email não parece válido. Escreva, por exemplo, nome@exemplo.pt.' : undefined,
    bookingLink: b.bookingLink.trim() && !isHttpUrl(b.bookingLink) ? LINK_ERROR : undefined,
    website: b.website.trim() && !isHttpUrl(b.website) ? LINK_ERROR : undefined,
  });
}

export function validatePostInput(i: PostInput): Errors<'service' | 'audience'> {
  return compact({
    service: i.service.trim() ? tooLong(i.service, 80) : 'Indique o serviço ou produto de que quer falar.',
    audience: i.audience.trim() ? tooLong(i.audience, 120) : 'Indique a quem se dirige a publicação.',
  });
}

function itemsError(items: { description: string; price: string }[]): string | undefined {
  if (items.length === 0) return 'Adicione pelo menos um serviço com descrição e preço.';
  for (const [index, item] of items.entries()) {
    if (!item.description.trim()) return `Linha ${index + 1}: indique a descrição do serviço.`;
    if (parseEuros(item.price) === null) return `Linha ${index + 1}: o preço não é válido. Escreva, por exemplo, 12,50.`;
  }
  return undefined;
}

export function validateQuoteDraft(d: { clientName: string; items: { description: string; price: string }[]; deadline: string }): Errors<'clientName' | 'items' | 'deadline'> {
  return compact({
    clientName: d.clientName.trim() ? tooLong(d.clientName, 80) : 'Indique o nome do cliente.',
    items: itemsError(d.items),
    deadline: tooLong(d.deadline, 80),
  });
}
