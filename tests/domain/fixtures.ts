import type { BusinessProfile, PostInput } from '../../src/domain/types';

export const empty: BusinessProfile = { name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [], accentColor: '#1B4DB1', isExample: false };

export const input = { channel: 'instagram', goal: 'divulgar-servico', service: 'Corte de cabelo', audience: 'clientes do bairro', tone: 'proximo' } as const satisfies PostInput;

export const now = new Date(2026, 10, 1, 9);                 // 1 Nov 2026
