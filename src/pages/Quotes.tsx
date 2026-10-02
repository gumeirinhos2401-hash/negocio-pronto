import { useState, type FormEvent } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { CopyButton, useCopy } from '../components/CopyButton';
import { Dialog } from '../components/Dialog';
import { ExampleTag } from '../components/ExampleTag';
import { Field } from '../components/Field';
import { QuoteDocument } from '../components/QuoteDocument';
import { Select } from '../components/Select';
import { TextArea } from '../components/TextArea';
import { useToast } from '../components/Toast';
import { usePageTitle } from '../components/usePageTitle';
import { newId } from '../domain/id';
import { formatEuros, parseEuros } from '../domain/money';
import { nextQuoteNumber, quoteToText, quoteTotal } from '../domain/quotes';
import type { Quote, VatNote } from '../domain/types';
import { validateQuoteDraft, type Errors } from '../domain/validation';
import { downloadQuotePdf } from '../pdf/quotePdf';
import { useBusiness, useQuotes } from '../storage/areas';
import { focusField, focusSoon, formatShortDate } from './format';
import { toOptions, VAT_LABELS } from './labels';
import './Quotes.css';

interface ItemDraft { id: string; description: string; price: string }

interface Draft {
  editingId: string | null;
  number: string;
  createdAt: string;
  clientName: string;
  items: ItemDraft[];
  deadline: string;
  notes: string;
  vatNote: VatNote;
  isExample: boolean;
}

type DraftErrors = Errors<'clientName' | 'items' | 'deadline'>;

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const emptyItem = (): ItemDraft => ({ id: newId(), description: '', price: '' });

function newDraft(quotes: Quote[]): Draft {
  const now = new Date();
  return {
    editingId: null, number: nextQuoteNumber(quotes, now), createdAt: now.toISOString(),
    clientName: '', items: [emptyItem()], deadline: '', notes: '', vatNote: 'nenhuma', isExample: false,
  };
}

function draftFrom(quote: Quote): Draft {
  return {
    editingId: quote.id, number: quote.number, createdAt: quote.createdAt, clientName: quote.clientName,
    items: quote.items.map((item) => ({ id: item.id, description: item.description, price: centsToInput(item.priceCents) })),
    deadline: quote.deadline, notes: quote.notes, vatNote: quote.vatNote, isExample: quote.isExample,
  };
}

// Only lines that are complete go into the document, so the total never includes a guess.
function toQuote(draft: Draft): Quote {
  const items = draft.items.flatMap((item) => {
    const priceCents = parseEuros(item.price);
    return item.description.trim() && priceCents !== null ? [{ id: item.id, description: item.description.trim(), priceCents }] : [];
  });
  return {
    id: draft.editingId ?? newId(), number: draft.number, createdAt: draft.createdAt, clientName: draft.clientName.trim(),
    items, deadline: draft.deadline.trim(), notes: draft.notes.trim(), vatNote: draft.vatNote, isExample: draft.isExample,
  };
}

// The validator reports one message for the item list; this finds the field it refers to.
function firstInvalidItem(items: ItemDraft[]): { id: string; field: 'description' | 'price' } | null {
  for (const item of items) {
    if (!item.description.trim()) return { id: item.id, field: 'description' };
    if (parseEuros(item.price) === null) return { id: item.id, field: 'price' };
  }
  return null;
}

const itemFieldId = (id: string, field: 'description' | 'price') => `orc-${field === 'description' ? 'descricao' : 'preco'}-${id}`;

export default function Quotes() {
  usePageTitle('Orçamentos');
  const toast = useToast();
  const copy = useCopy();
  const [business] = useBusiness();
  const [quotes, setQuotes] = useQuotes();
  const [draft, setDraft] = useState<Draft>(() => newDraft(quotes));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const preview = toQuote(draft);
  const invalidItem = errors.items ? firstInvalidItem(draft.items) : null;

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setItem = (id: string, patch: Partial<ItemDraft>) =>
    setDraft((current) => ({ ...current, items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));

  const addItem = () => {
    const item = emptyItem();
    setDraft((current) => ({ ...current, items: [...current.items, item] }));
    window.setTimeout(() => focusField(itemFieldId(item.id, 'description')), 0);
  };

  const removeItem = (id: string) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    focusField('orc-adicionar');
  };

  // Returns the finished quote, or shows the errors and moves focus to the first one.
  const validQuote = (): Quote | null => {
    const nextErrors = validateQuoteDraft({ clientName: draft.clientName, items: draft.items, deadline: draft.deadline });
    setErrors(nextErrors);
    if (nextErrors.clientName) {
      focusField('orc-cliente');
      return null;
    }
    if (nextErrors.items) {
      const target = firstInvalidItem(draft.items);
      focusField(target ? itemFieldId(target.id, target.field) : 'orc-adicionar');
      return null;
    }
    if (nextErrors.deadline) {
      focusField('orc-prazo');
      return null;
    }
    return toQuote(draft);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const quote = validQuote();
    if (!quote) return;
    const next = draft.editingId
      ? quotes.map((existing) => (existing.id === draft.editingId ? quote : existing))
      : [quote, ...quotes];
    const saved = setQuotes(next);
    setDraft(newDraft(next));
    if (saved) toast.show('Orçamento guardado');
  };

  const handleCopy = () => {
    const quote = validQuote();
    if (quote) void copy(quoteToText(quote, business));
  };

  const download = async (quote: Quote) => {
    try {
      await downloadQuotePdf(quote, business);
      toast.show('PDF criado. Procure o ficheiro na pasta de transferências.');
    } catch {
      toast.show('Não foi possível criar o PDF. Tente outra vez ou use “Copiar texto”.', 'error');
    }
  };

  const handleDownload = () => {
    const quote = validQuote();
    if (quote) void download(quote);
  };

  const startEditing = (quote: Quote) => {
    setDraft(draftFrom(quote));
    setErrors({});
    focusField('orc-cliente');
  };

  const cancelEditing = () => {
    setDraft(newDraft(quotes));
    setErrors({});
  };

  const handleDelete = () => {
    const next = quotes.filter((quote) => quote.id !== deleteId);
    const saved = setQuotes(next);
    if (draft.editingId === deleteId) setDraft(newDraft(next));
    setDeleteId(null);
    focusSoon(() => document.getElementById('orc-guardados-titulo'));
    if (saved) toast.show('Orçamento apagado');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Orçamentos</h1>
        <p className="pagina__intro">Preencha os serviços e os preços. O documento ao lado atualiza enquanto escreve.</p>
      </header>

      {!business.name.trim() && (
        <p className="nota orcamentos__nota">
          O perfil do negócio está por preencher, por isso o documento sai sem nome e sem contactos.{' '}
          <Link to="/definicoes">Preencher o perfil</Link>
        </p>
      )}

      <div className="orcamentos__grelha">
        <form className="pilha orcamentos__formulario" onSubmit={handleSave} noValidate aria-labelledby="orc-form-titulo">
          <h2 className="seccao__titulo" id="orc-form-titulo">
            {draft.editingId ? `A editar o orçamento n.º ${draft.number}` : `Novo orçamento n.º ${draft.number}`}
          </h2>
          <Field label="Nome do cliente" id="orc-cliente" value={draft.clientName} onChange={set('clientName')} error={errors.clientName} required autoComplete="off" maxLength={120} />

          <fieldset className="orcamentos__itens">
            <legend>Serviços e preços</legend>
            <ul className="pilha">
              {draft.items.map((item, index) => (
                <li key={item.id} className="orcamentos__item">
                  <Field
                    label={`Descrição do serviço ${index + 1}`}
                    id={itemFieldId(item.id, 'description')}
                    value={item.description}
                    onChange={(description) => setItem(item.id, { description })}
                    error={invalidItem?.id === item.id && invalidItem.field === 'description' ? errors.items : undefined}
                    maxLength={200}
                  />
                  <Field
                    label="Preço (€)"
                    id={itemFieldId(item.id, 'price')}
                    value={item.price}
                    onChange={(price) => setItem(item.id, { price })}
                    error={invalidItem?.id === item.id && invalidItem.field === 'price' ? errors.items : undefined}
                    inputMode="decimal"
                    maxLength={12}
                  />
                  {draft.items.length > 1 && (
                    <Button variant="quiet" className="orcamentos__remover" onClick={() => removeItem(item.id)} aria-label={`Remover o serviço ${index + 1}`}>
                      <Trash2 aria-hidden="true" />
                      Remover
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div>
              <Button id="orc-adicionar" onClick={addItem}>
                <Plus aria-hidden="true" />
                Adicionar serviço
              </Button>
            </div>
          </fieldset>

          <Field label="Prazo" id="orc-prazo" value={draft.deadline} onChange={set('deadline')} error={errors.deadline} hint="Por exemplo: orçamento válido por 30 dias." maxLength={120} />
          <TextArea label="Observações" id="orc-notas" value={draft.notes} onChange={set('notes')} rows={3} maxLength={1500} />
          <Select label="Nota sobre o IVA" id="orc-iva" value={draft.vatNote} onChange={set('vatNote')} options={toOptions(VAT_LABELS)} hint="A aplicação não calcula o IVA. Só acrescenta esta nota ao documento." />

          <div className="acoes acoes--empilhar">
            <Button variant="primary" type="submit">Guardar orçamento</Button>
            <Button onClick={handleCopy}>Copiar texto</Button>
            <Button onClick={handleDownload}>
              <Download aria-hidden="true" />
              Descarregar PDF
            </Button>
            {draft.editingId && <Button variant="quiet" onClick={cancelEditing}>Cancelar edição</Button>}
          </div>
        </form>

        <section className="orcamentos__previa" aria-labelledby="orc-previa-titulo">
          <h2 className="seccao__titulo" id="orc-previa-titulo">Documento</h2>
          <div className="so-impressao">
            <QuoteDocument quote={preview} business={business} emptyItemsText="Os serviços com descrição e preço aparecem aqui." />
          </div>
        </section>
      </div>

      <section className="seccao orcamentos__guardados" aria-labelledby="orc-guardados-titulo">
        <h2 className="seccao__titulo orcamentos__foco" id="orc-guardados-titulo" tabIndex={-1}>Orçamentos guardados</h2>
        {quotes.length === 0 ? (
          <p className="seccao__texto">Ainda não guardou nenhum orçamento. Preencha o formulário acima e carregue em “Guardar orçamento”.</p>
        ) : (
          <ul className="lista-linhas orcamentos__lista">
            {quotes.map((quote) => (
              <li key={quote.id} className="orcamentos__guardado">
                <div className="orcamentos__guardado-texto">
                  <h3>
                    Orçamento n.º {quote.number} {quote.isExample && <ExampleTag />}
                  </h3>
                  <p className="texto-utilizador">{quote.clientName}</p>
                  <p className="secundario pequeno">{formatEuros(quoteTotal(quote))}, criado a {formatShortDate(quote.createdAt)}</p>
                </div>
                <div className="acoes">
                  <Button variant="quiet" onClick={() => startEditing(quote)} aria-label={`Editar o orçamento n.º ${quote.number}`}>
                    <Pencil aria-hidden="true" />
                    Editar
                  </Button>
                  <CopyButton text={quoteToText(quote, business)} label="Copiar texto" />
                  <Button variant="quiet" onClick={() => void download(quote)} aria-label={`Descarregar PDF do orçamento n.º ${quote.number}`}>
                    <Download aria-hidden="true" />
                    Descarregar PDF
                  </Button>
                  <Button variant="quiet" onClick={() => setDeleteId(quote.id)} aria-label={`Apagar o orçamento n.º ${quote.number}`}>
                    <Trash2 aria-hidden="true" />
                    Apagar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={deleteId !== null} title="Apagar este orçamento?" onClose={() => setDeleteId(null)}>
        <p>O orçamento é apagado deste navegador. Esta ação não pode ser desfeita.</p>
        <div className="dialogo__acoes">
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Apagar orçamento</Button>
        </div>
      </Dialog>
    </>
  );
}
