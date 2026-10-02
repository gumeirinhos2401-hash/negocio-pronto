import { ChevronRight, FileText, MessageSquareText, PenLine, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { CategoryMark } from '../components/CategoryMark';
import { EmptyState } from '../components/EmptyState';
import { ExampleTag } from '../components/ExampleTag';
import { useToast } from '../components/Toast';
import { useNow } from '../components/useNow';
import { usePageTitle } from '../components/usePageTitle';
import { isoDate } from '../domain/dates';
import { FREE_POST_LIMIT, planStatus } from '../domain/plan';
import type { CalendarEntry } from '../domain/types';
import { hasExamples, useAccountData, useBusiness, useCalendar, usePlan, usePosts, usePostsUsedThisMonth, useQuotes } from '../storage/areas';
import { formatDayLong, parseIsoDay } from './format';
import { CATEGORY_LABELS } from './labels';
import './Dashboard.css';

const ACTIONS: { to: string; label: string; text: string; icon: LucideIcon }[] = [
  { to: '/publicacoes', label: 'Criar uma publicação', text: 'Título, legenda e hashtags para copiar.', icon: PenLine },
  { to: '/respostas', label: 'Responder a um cliente', text: 'Respostas sobre preços, horários, marcações e mais.', icon: MessageSquareText },
  { to: '/orcamentos', label: 'Fazer um orçamento', text: 'Documento em euros, para copiar ou descarregar em PDF.', icon: FileText },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function whenLabel(entry: CalendarEntry, now: Date): string {
  const today = parseIsoDay(isoDate(now)).getTime();
  const days = Math.round((parseIsoDay(entry.date).getTime() - today) / DAY_MS);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Daqui a ${days} dias`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default function Dashboard() {
  usePageTitle('Painel');
  const toast = useToast();
  const [business] = useBusiness();
  const [posts] = usePosts();
  const [calendar] = useCalendar();
  const [quotes] = useQuotes();
  const [plan] = usePlan();
  const used = usePostsUsedThisMonth();
  const account = useAccountData();

  const now = useNow();
  const today = isoDate(now);
  const areas = { business, posts, calendar, quotes };
  const hasProfile = business.name.trim() !== '';

  const next = calendar
    .filter((entry) => entry.status === 'planeada' && entry.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const status = planStatus(plan, now);

  const loadExamples = async () => {
    if (await account.loadExamples()) toast.show('Dados de exemplo carregados');
  };
  const deleteExamples = async () => {
    if (await account.removeExamples()) toast.show('Dados de exemplo apagados');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>{hasProfile ? business.name : 'Painel'}</h1>
        <p className="pagina__intro">{capitalise(formatDayLong(now))}</p>
      </header>

      {hasExamples(areas) && (
        <div className="nota painel__exemplo">
          <p>
            <ExampleTag /> Está a ver dados de exemplo. O negócio, as publicações e o orçamento são fictícios.
          </p>
          <Button onClick={deleteExamples}>Apagar dados de exemplo</Button>
        </div>
      )}

      {!hasProfile ? (
        <EmptyState
          title="Comece pelo perfil do seu negócio"
          text="Com o nome, o horário e os serviços preenchidos, os textos já saem com os seus dados. Se preferir, veja primeiro a aplicação com um negócio fictício."
          action={{ label: 'Preencher o perfil do negócio', to: '/definicoes' }}
          secondaryAction={{ label: 'Ver com dados de exemplo', onClick: loadExamples }}
        />
      ) : (
        <>
          <div className="painel__hoje">
            <section className="painel__proxima" aria-labelledby="painel-proxima">
              <h2 className="painel__rotulo" id="painel-proxima">Próxima publicação planeada</h2>
              {next ? (
                <>
                  <p className="painel__quando">{whenLabel(next, now)}</p>
                  <p className="painel__data">{capitalise(formatDayLong(parseIsoDay(next.date)))}</p>
                  <p className="painel__titulo texto-utilizador">{next.title}</p>
                  <p className="painel__categoria">
                    <CategoryMark category={next.category} />
                    {CATEGORY_LABELS[next.category]}
                    {next.isExample && <ExampleTag />}
                  </p>
                  <Link to="/calendario">Abrir o calendário</Link>
                </>
              ) : (
                <>
                  <p className="painel__sem-plano">Não tem nenhuma publicação planeada.</p>
                  <p className="secundario">O calendário sugere ideias para o mês e pode ajustá-las ao seu ritmo.</p>
                  <Link to="/calendario">Planear o mês no calendário</Link>
                </>
              )}
            </section>

            <section className="painel__mes" aria-labelledby="painel-mes">
              <h2 className="painel__rotulo" id="painel-mes">Publicações deste mês</h2>
              {status.kind === 'teste' ? (
                <>
                  <p className="painel__contagem">
                    {status.daysLeft === 1 ? 'Falta 1 dia de teste do Pro' : `Faltam ${status.daysLeft} dias de teste do Pro`}
                  </p>
                  <p className="secundario">Durante o teste pode guardar publicações sem limite. Guardou {used} este mês.</p>
                </>
              ) : (
                <>
                  <p className="painel__contagem">{Math.min(used, FREE_POST_LIMIT)} de {FREE_POST_LIMIT} publicações usadas este mês</p>
                  <div className="painel__quadrados" aria-hidden="true">
                    {Array.from({ length: FREE_POST_LIMIT }, (_, index) => (
                      <span key={index} className={index < used ? 'painel__quadrado painel__quadrado--usado' : 'painel__quadrado'} />
                    ))}
                  </div>
                  <p className="secundario">
                    {status.kind === 'teste-terminado' && 'O teste do Pro terminou e voltou ao plano gratuito. '}
                    {used >= FREE_POST_LIMIT
                      ? 'Chegou ao limite do plano gratuito. Pode continuar a gerar e a copiar textos.'
                      : 'O plano gratuito guarda 5 publicações por mês.'}
                  </p>
                </>
              )}
              <Link to="/planos">Ver planos</Link>
            </section>
          </div>

          <section className="painel__acoes" aria-labelledby="painel-acoes">
            <h2 className="seccao__titulo" id="painel-acoes">O que quer fazer agora?</h2>
            <ul className="painel__lista">
              {ACTIONS.map(({ to, label, text, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className="painel__acao">
                    <Icon className="painel__acao-icone" aria-hidden="true" />
                    <span className="painel__acao-texto">
                      <span className="painel__acao-rotulo">{label}</span>
                      <span className="secundario pequeno">{text}</span>
                    </span>
                    <ChevronRight className="painel__acao-seta" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
