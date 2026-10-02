import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CopyButton } from '../components/CopyButton';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { ExampleTag } from '../components/ExampleTag';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Tag } from '../components/Tag';
import { TextArea } from '../components/TextArea';
import { useToast } from '../components/Toast';
import { useNow } from '../components/useNow';
import { usePageTitle } from '../components/usePageTitle';
import { newId } from '../domain/id';
import { canSavePost, FREE_POST_LIMIT, planStatus, postsUsedThisMonth } from '../domain/plan';
import { generatePost } from '../domain/posts';
import type { Channel, Goal, Post, PostInput, Tone } from '../domain/types';
import { validatePostInput, type Errors } from '../domain/validation';
import { useBusiness, usePlan, usePosts } from '../storage/areas';
import { focusField, focusSoon, formatShortDate } from './format';
import { CHANNEL_LABELS, GOAL_LABELS, TONE_LABELS, toOptions } from './labels';
import './PostGenerator.css';

const OTHER = '__outro';

interface Result {
  input: PostInput;
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
}

const splitHashtags = (text: string) => text.split(/\s+/).filter(Boolean);

function fullText(parts: { title: string; caption: string; cta: string; hashtags: string }): string {
  return [parts.title, parts.caption, parts.cta, parts.hashtags].map((part) => part.trim()).filter(Boolean).join('\n\n');
}

export default function PostGenerator() {
  usePageTitle('Publicações');
  const toast = useToast();
  const [business] = useBusiness();
  const [posts, setPosts] = usePosts();
  const [plan] = usePlan();

  const serviceNames = [...new Set(business.services.map((s) => s.name.trim()).filter(Boolean))];
  const [channel, setChannel] = useState<Channel>('instagram');
  const [goal, setGoal] = useState<Goal>('divulgar-servico');
  const [tone, setTone] = useState<Tone>('proximo');
  const [serviceChoice, setServiceChoice] = useState<string>(serviceNames[0] ?? OTHER);
  const [typedService, setTypedService] = useState('');
  const [audience, setAudience] = useState('');
  const [errors, setErrors] = useState<Errors<'service' | 'audience'>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [captionError, setCaptionError] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resultHeading = useRef<HTMLHeadingElement>(null);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  const [generation, setGeneration] = useState(0);

  // Moves focus to the new text so it is announced and easy to reach by keyboard.
  useEffect(() => {
    if (generation > 0) resultHeading.current?.focus();
  }, [generation]);

  const now = useNow();
  const status = planStatus(plan, now);
  const used = postsUsedThisMonth(posts, now);
  const mayStore = canSavePost(posts, plan, now);
  const usesServiceList = serviceNames.length > 0;
  const typing = !usesServiceList || serviceChoice === OTHER;

  const handleGenerate = (event: FormEvent) => {
    event.preventDefault();
    const input: PostInput = { channel, goal, tone, audience: audience.trim(), service: (typing ? typedService : serviceChoice).trim() };
    const nextErrors = validatePostInput(input);
    setErrors(nextErrors);
    if (nextErrors.service) {
      focusField(typing ? 'pub-servico-texto' : 'pub-servico');
      return;
    }
    if (nextErrors.audience) {
      focusField('pub-publico');
      return;
    }
    const generated = generatePost(input, business);
    setResult({ input, title: generated.title, caption: generated.caption, cta: generated.cta, hashtags: generated.hashtags.join(' ') });
    setCaptionError(undefined);
    setGeneration((count) => count + 1);
  };

  const editResult = (patch: Partial<Result>) => setResult((current) => (current ? { ...current, ...patch } : current));

  const handleSave = () => {
    if (!result) return;
    if (!result.caption.trim()) {
      setCaptionError('Escreva a legenda antes de guardar a publicação.');
      focusField('res-legenda');
      return;
    }
    const post: Post = {
      ...result.input,
      id: newId(),
      createdAt: new Date().toISOString(),
      title: result.title.trim(),
      caption: result.caption.trim(),
      cta: result.cta.trim(),
      hashtags: splitHashtags(result.hashtags),
      isExample: false,
    };
    const saved = setPosts([post, ...posts]);
    setResult(null);
    savedHeading.current?.focus();
    if (saved) toast.show('Publicação guardada');
  };

  const handleDelete = () => {
    const saved = setPosts(posts.filter((post) => post.id !== deleteId));
    setDeleteId(null);
    focusSoon(() => savedHeading.current);
    if (saved) toast.show('Publicação apagada');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Publicações</h1>
        <p className="pagina__intro">
          Escolha o que quer comunicar e receba um texto para rever e copiar. A aplicação prepara o texto. É você que o coloca nas redes sociais.
        </p>
      </header>

      {!business.name.trim() && (
        <p className="nota publicacoes__nota">
          O perfil do negócio está por preencher, por isso o texto sai sem o nome e sem contactos.{' '}
          <Link to="/definicoes">Preencher o perfil</Link>
        </p>
      )}

      <div className="publicacoes__grelha">
        <form className="pilha" onSubmit={handleGenerate} noValidate aria-labelledby="pub-form-titulo">
          <h2 className="seccao__titulo" id="pub-form-titulo">Sobre a publicação</h2>
          <Select label="Onde vai ser usada" id="pub-canal" value={channel} onChange={setChannel} options={toOptions(CHANNEL_LABELS)} />
          <Select label="Objetivo" id="pub-objetivo" value={goal} onChange={setGoal} options={toOptions(GOAL_LABELS)} />
          {usesServiceList && (
            <Select
              label="Serviço ou produto"
              id="pub-servico"
              value={serviceChoice}
              onChange={setServiceChoice}
              options={[...serviceNames.map((name) => ({ value: name, label: name })), { value: OTHER, label: 'Outro, escrito por mim' }]}
              error={typing ? undefined : errors.service}
            />
          )}
          {typing && (
            <Field
              label={usesServiceList ? 'Nome do serviço ou produto' : 'Serviço ou produto'}
              id="pub-servico-texto"
              value={typedService}
              onChange={setTypedService}
              error={errors.service}
              hint="Por exemplo: corte de cabelo, menu do dia, arranjos de costura."
              required
              maxLength={100}
            />
          )}
          <Field
            label="A quem se dirige"
            id="pub-publico"
            value={audience}
            onChange={setAudience}
            error={errors.audience}
            hint="Por exemplo: clientes do bairro, quem trabalha na zona."
            required
            maxLength={140}
          />
          <Select label="Tom" id="pub-tom" value={tone} onChange={setTone} options={toOptions(TONE_LABELS)} />
          <div>
            <Button variant="primary" type="submit">Gerar publicação</Button>
          </div>
        </form>

        <section aria-labelledby="pub-resultado-titulo">
          <h2 className="seccao__titulo publicacoes__foco" id="pub-resultado-titulo" ref={resultHeading} tabIndex={-1}>Texto gerado</h2>
          {!result ? (
            <p className="secundario publicacoes__espera">
              O texto aparece aqui depois de carregar em “Gerar publicação”. Pode editá-lo antes de copiar ou guardar.
            </p>
          ) : (
            <Card className="publicacoes__resultado">
              <p className="publicacoes__meta">
                <Tag tone="accent">{CHANNEL_LABELS[result.input.channel]}</Tag>
                <span className="secundario pequeno">Reveja o texto antes de o usar. Pode alterar tudo.</span>
              </p>
              <div className="publicacoes__campo">
                <Field label="Título" id="res-titulo" value={result.title} onChange={(title) => editResult({ title })} maxLength={200} />
                <CopyButton text={result.title} label="Copiar título" />
              </div>
              <div className="publicacoes__campo">
                <TextArea label="Legenda" id="res-legenda" value={result.caption} onChange={(caption) => editResult({ caption })} rows={8} maxLength={2200} error={captionError} />
                <CopyButton text={result.caption} label="Copiar legenda" />
              </div>
              <div className="publicacoes__campo">
                <Field label="Chamada para ação" id="res-cta" value={result.cta} onChange={(cta) => editResult({ cta })} maxLength={400} />
                <CopyButton text={result.cta} label="Copiar chamada para ação" />
              </div>
              {result.input.channel === 'instagram' ? (
                <div className="publicacoes__campo">
                  <TextArea label="Hashtags" id="res-hashtags" value={result.hashtags} onChange={(hashtags) => editResult({ hashtags })} rows={2} maxLength={600} hint="Separadas por espaços." />
                  <CopyButton text={result.hashtags} label="Copiar hashtags" />
                </div>
              ) : (
                <p className="secundario pequeno">Este texto não leva hashtags. Só as publicações para o Instagram as incluem.</p>
              )}

              <div className="publicacoes__fim">
                {mayStore ? (
                  <div className="acoes acoes--empilhar">
                    <Button variant="primary" onClick={handleSave}>Guardar publicação</Button>
                    <CopyButton text={fullText(result)} label="Copiar tudo" variant="secondary" />
                  </div>
                ) : (
                  <>
                    <p className="publicacoes__limite" role="status">
                      Já guardou {FREE_POST_LIMIT} publicações este mês, o limite do plano gratuito. Pode continuar a gerar e a copiar textos.{' '}
                      <Link to="/planos">Ver planos</Link>
                    </p>
                    <div className="acoes acoes--empilhar">
                      <CopyButton text={fullText(result)} label="Copiar tudo" variant="primary" />
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </section>
      </div>

      <section className="seccao publicacoes__guardadas" aria-labelledby="pub-guardadas-titulo">
        <h2 className="seccao__titulo publicacoes__foco" id="pub-guardadas-titulo" ref={savedHeading} tabIndex={-1}>Publicações guardadas</h2>
        <p className="seccao__texto">
          {status.kind === 'teste'
            ? `Teste do Pro ativo: sem limite de publicações guardadas. Guardou ${used} este mês.`
            : `${Math.min(used, FREE_POST_LIMIT)} de ${FREE_POST_LIMIT} publicações guardadas este mês.`}
        </p>

        {posts.length === 0 ? (
          <div className="publicacoes__vazio">
            <EmptyState
              title="Ainda não guardou nenhuma publicação"
              text="Gere um texto no formulário acima e guarde-o para o ter sempre à mão."
              action={{ label: 'Ir para o formulário', onClick: () => focusField('pub-canal') }}
            />
          </div>
        ) : (
          <ul className="lista-linhas publicacoes__lista">
            {posts.map((post) => (
              <li key={post.id}>
                <article className="publicacoes__item">
                  <div className="publicacoes__item-topo">
                    <h3 className="texto-utilizador">{post.title || 'Publicação sem título'}</h3>
                    <p className="publicacoes__meta">
                      <Tag>{CHANNEL_LABELS[post.channel]}</Tag>
                      {post.isExample && <ExampleTag />}
                      <span className="secundario pequeno">Guardada a {formatShortDate(post.createdAt)}</span>
                    </p>
                  </div>
                  <p className="texto-utilizador">{post.caption}</p>
                  {post.cta && <p className="texto-utilizador">{post.cta}</p>}
                  {post.hashtags.length > 0 && <p className="texto-utilizador secundario">{post.hashtags.join(' ')}</p>}
                  <div className="acoes">
                    <CopyButton text={fullText({ ...post, hashtags: post.hashtags.join(' ') })} label="Copiar tudo" variant="secondary" />
                    <Button variant="quiet" onClick={() => setDeleteId(post.id)}>
                      <Trash2 aria-hidden="true" />
                      Apagar
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={deleteId !== null} title="Apagar esta publicação?" onClose={() => setDeleteId(null)}>
        <p>A publicação é apagada deste navegador. Esta ação não pode ser desfeita.</p>
        <div className="dialogo__acoes">
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Apagar publicação</Button>
        </div>
      </Dialog>
    </>
  );
}
