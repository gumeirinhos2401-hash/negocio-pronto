import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { CategoryMark } from '../components/CategoryMark';
import { Dialog } from '../components/Dialog';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useNow } from '../components/useNow';
import { usePageTitle } from '../components/usePageTitle';
import { suggestMonth } from '../domain/calendar';
import { isoDate, monthGrid, monthKey } from '../domain/dates';
import { newId } from '../domain/id';
import type { CalendarCategory, CalendarEntry, CalendarStatus } from '../domain/types';
import { useBusiness, useCalendar } from '../storage/areas';
import { focusField, focusSoon, formatDay, formatDayLong, formatMonthTitle, formatWeekdayShort, parseIsoDay } from './format';
import { CATEGORY_LABELS, STATUS_LABELS, toOptions } from './labels';
import './CalendarPage.css';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as CalendarCategory[];

interface EntryDraft {
  id: string | null;            // null while adding a new entry
  date: string;
  category: CalendarCategory;
  title: string;
  status: CalendarStatus;
}

function isRealDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isoDate(parseIsoDay(value)) === value;
}

export default function CalendarPage() {
  usePageTitle('Calendário');
  const toast = useToast();
  const [business] = useBusiness();
  const [entries, setEntries] = useCalendar();

  const today = useNow();
  const todayIso = isoDate(today);
  const [view, setView] = useState({ year: today.getFullYear(), month0: today.getMonth() });
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [errors, setErrors] = useState<{ date?: string; title?: string }>({});
  const [confirmSuggest, setConfirmSuggest] = useState(false);

  const viewKey = monthKey(new Date(view.year, view.month0, 1));
  const monthTitle = formatMonthTitle(view.year, view.month0);
  const inView = (entry: CalendarEntry) => entry.date.startsWith(viewKey);
  const plannedInView = entries.filter((entry) => inView(entry) && entry.status === 'planeada');

  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (!inView(entry)) continue;
    byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
  }

  const changeMonth = (step: number) => {
    const next = new Date(view.year, view.month0 + step, 1);
    setView({ year: next.getFullYear(), month0: next.getMonth() });
  };

  const openNew = (date: string) => {
    setErrors({});
    setDraft({ id: null, date, category: 'servico', title: '', status: 'planeada' });
  };

  const openEdit = (entry: CalendarEntry) => {
    setErrors({});
    setDraft({ id: entry.id, date: entry.date, category: entry.category, title: entry.title, status: entry.status });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const nextErrors = {
      date: isRealDay(draft.date) ? undefined : 'Escolha uma data válida.',
      title: draft.title.trim() ? undefined : 'Escreva sobre o que vai ser a publicação.',
    };
    setErrors(nextErrors);
    if (nextErrors.date) {
      focusField('cal-data');
      return;
    }
    if (nextErrors.title) {
      focusField('cal-titulo');
      return;
    }
    const fields = { date: draft.date, category: draft.category, title: draft.title.trim(), status: draft.status };
    const next = draft.id === null
      ? [...entries, { ...fields, id: newId(), postId: null, isExample: false }]
      : entries.map((entry) => (entry.id === draft.id ? { ...entry, ...fields } : entry));
    const saved = setEntries(next);
    const day = parseIsoDay(draft.date);
    setView({ year: day.getFullYear(), month0: day.getMonth() });
    setDraft(null);
    if (saved) toast.show(draft.id === null ? 'Publicação adicionada ao calendário' : 'Alterações guardadas');
  };

  const handleDelete = () => {
    if (!draft) return;
    const saved = setEntries(entries.filter((entry) => entry.id !== draft.id));
    setDraft(null);
    // The entry that opened the dialog is gone, so focus goes to the month heading.
    focusSoon(() => document.getElementById('cal-mes'));
    if (saved) toast.show('Publicação apagada do calendário');
  };

  const applySuggestions = () => {
    const suggestions = suggestMonth(view.year, view.month0, business).map((entry) => ({ ...entry, id: newId() }));
    // Planned entries of this month are replaced. Published and cancelled ones are a record and stay.
    const kept = entries.filter((entry) => !(inView(entry) && entry.status === 'planeada'));
    const saved = setEntries([...kept, ...suggestions]);
    setConfirmSuggest(false);
    if (saved) toast.show('Sugestões adicionadas ao calendário');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Calendário</h1>
        <p className="pagina__intro">Planeie o que vai comunicar em cada dia e registe o que já fez.</p>
      </header>

      <div className="calendario__barra">
        <h2 className="calendario__mes" id="cal-mes" tabIndex={-1} aria-live="polite">{monthTitle}</h2>
        <div className="calendario__navegar">
          <Button onClick={() => changeMonth(-1)}>
            <ChevronLeft aria-hidden="true" />
            Mês anterior
          </Button>
          <Button onClick={() => changeMonth(1)}>
            Mês seguinte
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="acoes acoes--empilhar calendario__acoes">
        <Button variant="primary" onClick={() => (plannedInView.length > 0 ? setConfirmSuggest(true) : applySuggestions())}>
          Sugerir publicações para este mês
        </Button>
        <Button onClick={() => openNew(viewKey === monthKey(today) ? todayIso : `${viewKey}-01`)}>
          <Plus aria-hidden="true" />
          Adicionar publicação
        </Button>
      </div>

      {!entries.some(inView) && (
        <p className="nota nota--neutra calendario__vazio">
          Este mês ainda não tem nada planeado. Peça sugestões ou adicione uma publicação num dia à sua escolha.
        </p>
      )}

      <div className="calendario__semana" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <ol className="calendario__grelha" aria-label={`Dias de ${monthTitle}`}>
        {monthGrid(view.year, view.month0).map((iso, index) => {
          if (iso === null) return <li key={`fora-${index}`} className="calendario__dia calendario__dia--fora" aria-hidden="true" />;
          const date = parseIsoDay(iso);
          const dayEntries = byDay.get(iso) ?? [];
          const isToday = iso === todayIso;
          return (
            <li key={iso} className={`calendario__dia${isToday ? ' calendario__dia--hoje' : ''}`}>
              <div className="calendario__dia-topo">
                <p className="calendario__data">
                  <span className="so-leitor-ecra">{formatDayLong(date)}</span>
                  <span aria-hidden="true">
                    <span className="calendario__dia-semana">{formatWeekdayShort(date)} </span>
                    <span className="calendario__numero">{date.getDate()}</span>
                  </span>
                  {isToday && <span className="calendario__hoje">Hoje</span>}
                </p>
                <button type="button" className="calendario__mais" onClick={() => openNew(iso)} aria-label={`Adicionar publicação a ${formatDay(date)}`}>
                  <Plus aria-hidden="true" />
                </button>
              </div>
              {dayEntries.length > 0 && (
                <ul className="calendario__entradas">
                  {dayEntries.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" className={`calendario__entrada calendario__entrada--${entry.status}`} onClick={() => openEdit(entry)}>
                        <span className="calendario__categoria">
                          <CategoryMark category={entry.category} />
                          <span className="calendario__categoria-nome">{CATEGORY_LABELS[entry.category]}</span>
                        </span>
                        <span className="calendario__titulo">{entry.title}</span>
                        <span className="calendario__estado">
                          {STATUS_LABELS[entry.status]}{entry.isExample ? ', exemplo' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <p className="calendario__aviso">
        Marcar como publicada é só um registo seu. A Negócio Pronto não publica nas redes sociais.
      </p>

      <section className="calendario__legenda" aria-labelledby="cal-legenda-titulo">
        <h2 className="calendario__legenda-titulo" id="cal-legenda-titulo">Categorias</h2>
        <ul>
          {CATEGORIES.map((category) => (
            <li key={category}>
              <CategoryMark category={category} />
              {CATEGORY_LABELS[category]}
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={draft !== null} title={draft?.id === null ? 'Adicionar publicação' : 'Editar publicação'} onClose={() => setDraft(null)}>
        {draft && (
          <form className="pilha" onSubmit={handleSubmit} noValidate>
            <Field label="Dia" id="cal-data" type="date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} error={errors.date} required />
            <Select label="Categoria" id="cal-categoria" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={toOptions(CATEGORY_LABELS)} />
            <Field label="Sobre o que é a publicação" id="cal-titulo" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} error={errors.title} required maxLength={160} />
            <Select
              label="Estado"
              id="cal-estado"
              value={draft.status}
              onChange={(status) => setDraft({ ...draft, status })}
              options={toOptions(STATUS_LABELS)}
              hint="“Publicada” é um registo seu. A aplicação não publica nas redes sociais."
            />
            <div className="dialogo__acoes">
              {draft.id !== null && <Button variant="danger" onClick={handleDelete}>Apagar do calendário</Button>}
              <Button onClick={() => setDraft(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">{draft.id === null ? 'Adicionar ao calendário' : 'Guardar alterações'}</Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={confirmSuggest} title="Substituir as publicações planeadas?" onClose={() => setConfirmSuggest(false)}>
        <p>
          {plannedInView.length === 1
            ? `Tem 1 publicação planeada em ${monthTitle.toLowerCase()}. Ela é substituída pelas novas sugestões.`
            : `Tem ${plannedInView.length} publicações planeadas em ${monthTitle.toLowerCase()}. Todas são substituídas pelas novas sugestões.`}
          {' '}As publicadas e as canceladas mantêm-se.
        </p>
        <div className="dialogo__acoes">
          <Button onClick={() => setConfirmSuggest(false)}>Manter as que tenho</Button>
          <Button variant="primary" onClick={applySuggestions}>Substituir pelas sugestões</Button>
        </div>
      </Dialog>
    </>
  );
}
