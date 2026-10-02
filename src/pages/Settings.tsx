import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { ExampleTag } from '../components/ExampleTag';
import { Field } from '../components/Field';
import { TextArea } from '../components/TextArea';
import { useToast } from '../components/Toast';
import { usePageTitle } from '../components/usePageTitle';
import { newId } from '../domain/id';
import { parseEuros } from '../domain/money';
import type { BusinessProfile, Service } from '../domain/types';
import { validateBusiness, type Errors } from '../domain/validation';
import {
  addExamples, DEFAULT_ACCENT, EMPTY_BUSINESS, FREE_PLAN, hasExamples, removeExamples,
  useBusiness, useCalendar, usePlan, usePosts, useQuotes, useReplyOverrides,
} from '../storage/areas';
import { HEX_COLOR } from '../storage/guards';
import { clearAll } from '../storage/store';
import { focusField } from './format';
import './Settings.css';

interface ServiceDraft { id: string; name: string; price: string }
type Draft = Omit<BusinessProfile, 'services' | 'isExample'> & { services: ServiceDraft[] };
type BusinessErrors = Errors<'name' | 'category' | 'city' | 'phone' | 'email' | 'bookingLink' | 'website'>;
type ServiceErrors = Record<string, { name?: string; price?: string }>;

const FIELD_IDS: Record<keyof BusinessErrors, string> = {
  name: 'negocio-nome',
  category: 'negocio-categoria',
  city: 'negocio-cidade',
  phone: 'negocio-telefone',
  email: 'negocio-email',
  bookingLink: 'negocio-marcacao',
  website: 'negocio-site',
};

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function toDraft(business: BusinessProfile): Draft {
  return {
    ...business,
    services: business.services.map((s) => ({ id: s.id, name: s.name, price: s.priceCents === null ? '' : centsToInput(s.priceCents) })),
  };
}

function validateServices(services: ServiceDraft[]): ServiceErrors {
  const errors: ServiceErrors = {};
  for (const service of services) {
    const name = service.name.trim();
    const price = service.price.trim();
    if (!name && !price) continue;             // empty rows are dropped on save
    const rowErrors: { name?: string; price?: string } = {};
    if (!name) rowErrors.name = 'Indique o nome do serviço.';
    else if (name.length > 80) rowErrors.name = 'Use no máximo 80 caracteres.';
    if (price && parseEuros(price) === null) rowErrors.price = 'O preço não é válido. Escreva, por exemplo, 12,50.';
    if (rowErrors.name || rowErrors.price) errors[service.id] = rowErrors;
  }
  return errors;
}

function toServices(services: ServiceDraft[]): Service[] {
  return services
    .filter((s) => s.name.trim())
    .map((s) => ({ id: s.id, name: s.name.trim(), priceCents: s.price.trim() ? parseEuros(s.price) : null }));
}

export default function Settings() {
  usePageTitle('Definições');
  const toast = useToast();
  const [business, setBusiness] = useBusiness();
  const [posts, setPosts] = usePosts();
  const [calendar, setCalendar] = useCalendar();
  const [quotes, setQuotes] = useQuotes();
  const [, setReplies] = useReplyOverrides();
  const [, setPlan] = usePlan();

  const [draft, setDraft] = useState<Draft>(() => toDraft(business));
  const [errors, setErrors] = useState<BusinessErrors>({});
  const [serviceErrors, setServiceErrors] = useState<ServiceErrors>({});
  const [confirm, setConfirm] = useState<'exemplo' | 'tudo' | null>(null);

  const areas = { business, posts, calendar, quotes };
  const examplesLoaded = hasExamples(areas);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setService = (id: string, patch: Partial<ServiceDraft>) =>
    setDraft((current) => ({ ...current, services: current.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addService = () => {
    const id = newId();
    setDraft((current) => ({ ...current, services: [...current.services, { id, name: '', price: '' }] }));
    // The new row exists only after the next render.
    window.setTimeout(() => focusField(`servico-nome-${id}`), 0);
  };

  const removeService = (id: string) => {
    setDraft((current) => ({ ...current, services: current.services.filter((s) => s.id !== id) }));
    focusField('adicionar-servico');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const accentColor = HEX_COLOR.test(draft.accentColor) ? draft.accentColor : DEFAULT_ACCENT;
    const next: BusinessProfile = {
      name: draft.name.trim(), category: draft.category.trim(), city: draft.city.trim(), description: draft.description.trim(),
      hours: draft.hours.trim(), phone: draft.phone.trim(), email: draft.email.trim(), address: draft.address.trim(),
      bookingLink: draft.bookingLink.trim(), instagram: draft.instagram.trim(), facebook: draft.facebook.trim(),
      website: draft.website.trim(),
      services: [],
      accentColor,
      // A saved profile is the user's own, even when it started from the example.
      isExample: false,
    };
    const nextErrors = validateBusiness(next);
    const nextServiceErrors = validateServices(draft.services);
    setErrors(nextErrors);
    setServiceErrors(nextServiceErrors);

    const firstField = (Object.keys(FIELD_IDS) as (keyof BusinessErrors)[]).find((key) => nextErrors[key]);
    if (firstField) {
      focusField(FIELD_IDS[firstField]);
      return;
    }
    const firstService = draft.services.find((s) => nextServiceErrors[s.id]);
    if (firstService) {
      focusField(nextServiceErrors[firstService.id].name ? `servico-nome-${firstService.id}` : `servico-preco-${firstService.id}`);
      return;
    }

    next.services = toServices(draft.services);
    setDraft(toDraft(next));
    if (setBusiness(next)) toast.show('Definições guardadas');
  };

  const loadExamples = () => {
    const next = addExamples(areas, new Date());
    const saved = [setBusiness(next.business), setPosts(next.posts), setCalendar(next.calendar), setQuotes(next.quotes)];
    setDraft(toDraft(next.business));
    setErrors({});
    setServiceErrors({});
    setConfirm(null);
    if (saved.every(Boolean)) toast.show('Dados de exemplo carregados');
  };

  const deleteExamples = () => {
    const next = removeExamples(areas);
    const saved = [setBusiness(next.business), setPosts(next.posts), setCalendar(next.calendar), setQuotes(next.quotes)];
    setDraft(toDraft(next.business));
    if (saved.every(Boolean)) toast.show('Dados de exemplo apagados');
  };

  const deleteEverything = () => {
    setBusiness(EMPTY_BUSINESS);
    setPosts([]);
    setCalendar([]);
    setQuotes([]);
    setReplies({});
    setPlan(FREE_PLAN);
    clearAll();
    setDraft(toDraft(EMPTY_BUSINESS));
    setErrors({});
    setServiceErrors({});
    setConfirm(null);
    toast.show('Todos os dados foram apagados');
  };

  const previewColor = HEX_COLOR.test(draft.accentColor) ? draft.accentColor : DEFAULT_ACCENT;

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Definições</h1>
        <p className="pagina__intro">
          Os textos das publicações, das respostas e dos orçamentos usam o que escrever aqui. Só o nome é obrigatório.
        </p>
      </header>

      {business.isExample && (
        <p className="nota definicoes__aviso">
          <ExampleTag /> Este perfil é fictício. Ao guardar, passa a ser o perfil do seu negócio.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <section className="seccao definicoes__seccao" aria-labelledby="sec-identificacao">
          <div>
            <h2 className="seccao__titulo" id="sec-identificacao">Identificação</h2>
            <p className="seccao__texto">Como o negócio se apresenta aos clientes.</p>
          </div>
          <div className="grelha-campos">
            <div className="campo--inteiro">
              <Field label="Nome do negócio" id={FIELD_IDS.name} value={draft.name} onChange={set('name')} error={errors.name} required autoComplete="organization" maxLength={120} />
            </div>
            <Field label="Categoria" id={FIELD_IDS.category} value={draft.category} onChange={set('category')} error={errors.category} hint="Por exemplo: café, barbearia, loja de roupa." maxLength={80} />
            <Field label="Cidade" id={FIELD_IDS.city} value={draft.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" maxLength={80} />
            <div className="campo--inteiro">
              <TextArea label="Descrição" id="negocio-descricao" value={draft.description} onChange={set('description')} rows={3} maxLength={400} hint="Uma ou duas frases sobre o que faz." />
            </div>
          </div>
        </section>

        <section className="seccao definicoes__seccao" aria-labelledby="sec-contactos">
          <div>
            <h2 className="seccao__titulo" id="sec-contactos">Contactos</h2>
            <p className="seccao__texto">Aparecem nas respostas aos clientes e nos orçamentos.</p>
          </div>
          <div className="grelha-campos">
            <div className="campo--inteiro">
              <Field label="Horário" id="negocio-horario" value={draft.hours} onChange={set('hours')} hint="Por exemplo: segunda a sexta, das 9h às 18h." maxLength={160} />
            </div>
            <Field label="Telefone ou telemóvel" id={FIELD_IDS.phone} value={draft.phone} onChange={set('phone')} error={errors.phone} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} />
            <Field label="Email" id={FIELD_IDS.email} value={draft.email} onChange={set('email')} error={errors.email} type="email" inputMode="email" autoComplete="email" maxLength={120} />
            <div className="campo--inteiro">
              <Field label="Morada" id="negocio-morada" value={draft.address} onChange={set('address')} autoComplete="street-address" maxLength={160} />
            </div>
            <div className="campo--inteiro">
              <Field label="Link de marcação" id={FIELD_IDS.bookingLink} value={draft.bookingLink} onChange={set('bookingLink')} error={errors.bookingLink} type="url" inputMode="url" hint="A página onde os clientes fazem a marcação, se tiver. Começa por https://." maxLength={300} />
            </div>
          </div>
        </section>

        <section className="seccao definicoes__seccao" aria-labelledby="sec-redes">
          <div>
            <h2 className="seccao__titulo" id="sec-redes">Redes sociais</h2>
            <p className="seccao__texto">Só para ficar registado. A aplicação não se liga a estas contas.</p>
          </div>
          <div className="grelha-campos">
            <Field label="Instagram" id="negocio-instagram" value={draft.instagram} onChange={set('instagram')} hint="Por exemplo: @onomedonegocio." maxLength={80} />
            <Field label="Facebook" id="negocio-facebook" value={draft.facebook} onChange={set('facebook')} hint="O nome da página." maxLength={120} />
            <div className="campo--inteiro">
              <Field label="Site" id={FIELD_IDS.website} value={draft.website} onChange={set('website')} error={errors.website} type="url" inputMode="url" hint="Começa por https://." maxLength={300} />
            </div>
          </div>
        </section>

        <section className="seccao definicoes__seccao" aria-labelledby="sec-servicos">
          <div>
            <h2 className="seccao__titulo" id="sec-servicos">Serviços e preços</h2>
            <p className="seccao__texto">O preço é opcional. Um serviço sem preço nunca aparece com um valor nas respostas.</p>
          </div>
          <div className="pilha">
            {draft.services.length === 0 && <p className="secundario">Ainda não tem serviços. Adicione o primeiro.</p>}
            {draft.services.length > 0 && (
              <ul className="pilha">
                {draft.services.map((service, index) => (
                  <li key={service.id} className="definicoes__servico">
                    <Field label={`Serviço ${index + 1}`} id={`servico-nome-${service.id}`} value={service.name} onChange={(name) => setService(service.id, { name })} error={serviceErrors[service.id]?.name} maxLength={100} />
                    <Field label="Preço (€)" id={`servico-preco-${service.id}`} value={service.price} onChange={(price) => setService(service.id, { price })} error={serviceErrors[service.id]?.price} inputMode="decimal" maxLength={12} />
                    <Button variant="quiet" className="definicoes__remover" onClick={() => removeService(service.id)} aria-label={`Remover o serviço ${index + 1}`}>
                      <Trash2 aria-hidden="true" />
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Button id="adicionar-servico" onClick={addService}>
                <Plus aria-hidden="true" />
                Adicionar serviço
              </Button>
            </div>
          </div>
        </section>

        <section className="seccao definicoes__seccao" aria-labelledby="sec-identidade">
          <div>
            <h2 className="seccao__titulo" id="sec-identidade">Identidade visual</h2>
            <p className="seccao__texto">A cor é usada só no documento do orçamento.</p>
          </div>
          <div className="pilha">
            <div className="definicoes__cor">
              <Field label="Cor do negócio" id="negocio-cor" type="color" value={previewColor} onChange={set('accentColor')} />
              <Button variant="quiet" onClick={() => set('accentColor')(DEFAULT_ACCENT)}>Repor a cor original</Button>
            </div>
            <div className="definicoes__amostra" aria-hidden="true">
              <span className="definicoes__amostra-faixa" style={{ background: previewColor }} />
              <span className="definicoes__amostra-nome">{draft.name.trim() || 'Nome do negócio'}</span>
              <span className="definicoes__amostra-titulo" style={{ color: previewColor }}>Orçamento</span>
            </div>
            <p className="secundario pequeno">Amostra do cabeçalho do orçamento com esta cor.</p>
          </div>
        </section>

        <div className="seccao definicoes__guardar">
          <Button variant="primary" type="submit">Guardar definições</Button>
        </div>
      </form>

      <section className="seccao definicoes__seccao" aria-labelledby="sec-dados">
        <div>
          <h2 className="seccao__titulo" id="sec-dados">Dados</h2>
          <p className="seccao__texto">Tudo fica guardado só neste navegador. Nada é enviado para fora.</p>
        </div>
        <ul className="lista-linhas definicoes__dados">
          <li>
            <div>
              <h3>Dados de exemplo</h3>
              <p className="secundario">
                {examplesLoaded
                  ? 'Há dados de exemplo carregados. São fictícios e estão marcados com a etiqueta Exemplo.'
                  : 'Um negócio fictício com publicações, calendário e um orçamento, para ver como tudo funciona.'}
              </p>
            </div>
            {examplesLoaded
              ? <Button onClick={deleteExamples}>Apagar dados de exemplo</Button>
              : (
                <Button onClick={() => (business.name.trim() ? setConfirm('exemplo') : loadExamples())}>
                  Carregar dados de exemplo
                </Button>
              )}
          </li>
          <li>
            <div>
              <h3>Apagar tudo</h3>
              <p className="secundario">Apaga o perfil, as publicações, o calendário, as respostas e os orçamentos deste navegador.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirm('tudo')}>Apagar todos os dados</Button>
          </li>
        </ul>
      </section>

      <Dialog open={confirm === 'exemplo'} title="Carregar dados de exemplo?" onClose={() => setConfirm(null)}>
        <p>
          O perfil do seu negócio é substituído pelo perfil fictício. As suas publicações, o calendário e os orçamentos
          mantêm-se, com os de exemplo ao lado.
        </p>
        <div className="dialogo__acoes">
          <Button onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="primary" onClick={loadExamples}>Carregar dados de exemplo</Button>
        </div>
      </Dialog>

      <Dialog open={confirm === 'tudo'} title="Apagar todos os dados?" onClose={() => setConfirm(null)}>
        <p>
          O perfil, as publicações, o calendário, as respostas, os orçamentos e o plano são apagados deste navegador.
          Esta ação não pode ser desfeita.
        </p>
        <div className="dialogo__acoes">
          <Button onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="danger" onClick={deleteEverything}>Apagar todos os dados</Button>
        </div>
      </Dialog>
    </>
  );
}
