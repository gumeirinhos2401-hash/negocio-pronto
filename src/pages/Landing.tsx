import { useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { CategoryMark } from '../components/CategoryMark';
import { ExampleTag } from '../components/ExampleTag';
import { QuoteDocument } from '../components/QuoteDocument';
import { Tag } from '../components/Tag';
import { TileBand } from '../components/TileBand';
import { useNow } from '../components/useNow';
import { usePageTitle } from '../components/usePageTitle';
import { demoData } from '../domain/demo';
import { formatEuros } from '../domain/money';
import { FREE_POST_LIMIT, PRO_PRICE_CENTS, TRIAL_DAYS } from '../domain/plan';
import { buildReply } from '../domain/replies';
import { formatDay, parseIsoDay } from './format';
import { CATEGORY_LABELS, CHANNEL_LABELS, STATUS_LABELS } from './labels';
import '../components/AppShell.css';
import './Landing.css';

function Tool({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="inicio__ferramenta">
      <div className="inicio__ferramenta-texto">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <figure className="inicio__exemplo">
        <figcaption>
          <ExampleTag /> <span>Negócio fictício, só para mostrar o resultado.</span>
        </figcaption>
        {children}
      </figure>
    </div>
  );
}

export default function Landing() {
  usePageTitle('');
  const main = useRef<HTMLElement>(null);
  // Every example below is produced by the app's own generators from the fictional demo business.
  const now = useNow();
  const demo = useMemo(() => demoData(now), [now]);
  const post = demo.posts[0];
  const reply = useMemo(() => buildReply('horarios', demo.business).text, [demo]);

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    main.current?.focus();
  };

  return (
    <div className="inicio">
      <a className="saltar" href="#conteudo" onClick={skipToContent}>Saltar para o conteúdo</a>
      <header className="inicio__topo">
        <div className="inicio__interior inicio__topo-interior">
          <span className="app__marca">Negócio Pronto</span>
          <nav aria-label="Principal">
            <Link to="/painel" className="inicio__entrar">Abrir o painel</Link>
          </nav>
        </div>
      </header>

      <main className="inicio__conteudo" id="conteudo" ref={main} tabIndex={-1}>
        <section className="inicio__heroi">
          <TileBand height={64} />
          <div className="inicio__interior inicio__heroi-texto">
            <h1>Publicações, respostas a clientes e orçamentos para o seu pequeno negócio.</h1>
            <p className="inicio__lema">
              Preencha o perfil do negócio uma vez. A Negócio Pronto prepara os textos com esses dados, para rever e copiar.
              A aplicação não se liga às redes sociais, por isso a publicação fica sempre do seu lado.
            </p>
            <div className="inicio__acao">
              <ButtonLink to="/painel" variant="primary" className="inicio__comecar">Começar</ButtonLink>
              <p className="secundario pequeno">Sem conta e sem instalação.</p>
            </div>
          </div>
        </section>

        <section className="inicio__interior inicio__ferramentas" aria-labelledby="inicio-ferramentas">
          <h2 id="inicio-ferramentas">Quatro ferramentas para o dia a dia</h2>

          <Tool
            title="Gerador de publicações"
            text="Escolha o objetivo, o serviço e o tom. Recebe título, legenda, chamada para ação e hashtags, para o Instagram, o Facebook ou o Perfil da Empresa no Google. Os textos nunca incluem preços ou promoções que não tenha escrito."
          >
            <Card className="inicio__publicacao">
              <p><Tag tone="accent">{CHANNEL_LABELS[post.channel]}</Tag></p>
              <p className="inicio__publicacao-titulo">{post.title}</p>
              <p className="texto-utilizador">{post.caption}</p>
              <p>{post.cta}</p>
              <p className="secundario texto-utilizador">{post.hashtags.join(' ')}</p>
            </Card>
          </Tool>

          <Tool
            title="Calendário de conteúdo"
            text="Sugestões para cada semana do mês, com as datas especiais portuguesas. Marque cada publicação como planeada, publicada ou cancelada. É um registo seu."
          >
            <ul className="inicio__calendario">
              {demo.calendar.slice(0, 4).map((entry) => (
                <li key={entry.id}>
                  <span className="inicio__calendario-dia">{formatDay(parseIsoDay(entry.date))}</span>
                  <span className="inicio__calendario-texto">
                    <span>{entry.title}</span>
                    <span className="inicio__calendario-meta">
                      <CategoryMark category={entry.category} />
                      {CATEGORY_LABELS[entry.category]}, {STATUS_LABELS[entry.status].toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Tool>

          <Tool
            title="Respostas rápidas"
            text="Respostas para perguntas sobre preços, horários, localização, reservas, atrasos, cancelamentos e reclamações. Usam só os dados do seu perfil e não prometem nada em seu nome."
          >
            <p className="inicio__resposta texto-utilizador">{reply}</p>
          </Tool>

          <Tool
            title="Orçamentos"
            text="Serviços, preços em euros, prazo e observações num documento com a cor do seu negócio. Copie o texto ou descarregue em PDF."
          >
            <QuoteDocument quote={demo.quotes[0]} business={demo.business} />
          </Tool>
        </section>

        <section className="inicio__interior inicio__planos" aria-labelledby="inicio-planos">
          <h2 id="inicio-planos">Planos</h2>
          <dl className="inicio__planos-lista">
            <div>
              <dt>Gratuito</dt>
              <dd>{FREE_POST_LIMIT} publicações guardadas por mês. Calendário, respostas e orçamentos incluídos.</dd>
            </div>
            <div>
              <dt>Pro, {formatEuros(PRO_PRICE_CENTS)} por mês</dt>
              <dd>Publicações guardadas sem limite, com teste gratuito de {TRIAL_DAYS} dias. Nesta versão o pagamento é uma simulação e nada é cobrado.</dd>
            </div>
          </dl>
          <div className="acoes">
            <ButtonLink to="/painel" variant="primary">Começar</ButtonLink>
            <ButtonLink to="/planos">Ver planos</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="inicio__rodape">
        <div className="inicio__interior">
          <p>A Negócio Pronto guarda os seus dados só neste navegador. Nada é enviado para servidores.</p>
        </div>
      </footer>
    </div>
  );
}
