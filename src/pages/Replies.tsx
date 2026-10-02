import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { Tag } from '../components/Tag';
import { TextArea } from '../components/TextArea';
import { useToast } from '../components/Toast';
import { usePageTitle } from '../components/usePageTitle';
import { buildReply, REPLY_TOPICS } from '../domain/replies';
import type { ReplyOverrides, ReplyTopic } from '../domain/types';
import { useBusiness, useReplyOverrides } from '../storage/areas';
import { focusField } from './format';
import './Replies.css';

const QUESTIONS: Record<ReplyTopic, string> = {
  precos: 'Quando perguntam quanto custa.',
  horarios: 'Quando perguntam a que horas está aberto.',
  localizacao: 'Quando perguntam onde fica.',
  reservas: 'Quando querem marcar ou reservar.',
  atrasos: 'Quando o cliente avisa que vai chegar atrasado.',
  cancelamentos: 'Quando o cliente cancela uma marcação.',
  reclamacoes: 'Quando o cliente não ficou satisfeito.',
};

export default function Replies() {
  usePageTitle('Respostas');
  const toast = useToast();
  const [business] = useBusiness();
  const [overrides, setOverrides] = useReplyOverrides();
  const [drafts, setDrafts] = useState<ReplyOverrides>({});
  const [errors, setErrors] = useState<Partial<Record<ReplyTopic, string>>>({});

  const save = (topic: ReplyTopic, text: string) => {
    if (!text.trim()) {
      setErrors((current) => ({ ...current, [topic]: 'Escreva a resposta antes de guardar.' }));
      focusField(`resposta-${topic}`);
      return;
    }
    setErrors((current) => ({ ...current, [topic]: undefined }));
    setDrafts((current) => ({ ...current, [topic]: undefined }));
    if (setOverrides({ ...overrides, [topic]: text })) toast.show('Alteração guardada');
  };

  const reset = (topic: ReplyTopic) => {
    const next = { ...overrides };
    delete next[topic];
    setErrors((current) => ({ ...current, [topic]: undefined }));
    setDrafts((current) => ({ ...current, [topic]: undefined }));
    if (setOverrides(next)) toast.show('Texto original reposto');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Respostas</h1>
        <p className="pagina__intro">
          Sete respostas para as perguntas mais comuns, já com os dados do seu perfil. Copie e cole na conversa com o cliente.
        </p>
      </header>

      {REPLY_TOPICS.map(({ topic, label }) => {
        const built = buildReply(topic, business);
        const stored = overrides[topic];
        const text = drafts[topic] ?? stored ?? built.text;
        const changed = text !== (stored ?? built.text);
        const customised = stored !== undefined && stored !== built.text;
        return (
          <section key={topic} className="seccao respostas__seccao" aria-labelledby={`resposta-titulo-${topic}`}>
            <div className="respostas__sobre">
              <h2 className="seccao__titulo" id={`resposta-titulo-${topic}`}>{label}</h2>
              <p className="seccao__texto">{QUESTIONS[topic]}</p>
              {customised && <p className="respostas__estado"><Tag tone="accent">Texto alterado por si</Tag></p>}
              {built.missing.length > 0 && (
                <p className="respostas__falta">
                  Faltam no perfil: {built.missing.join(', ')}. A resposta foi escrita sem esses dados.{' '}
                  <Link to="/definicoes">Preencher nas definições</Link>
                </p>
              )}
            </div>
            <div className="pilha">
              <TextArea
                label={`Resposta sobre ${label.toLowerCase()}`}
                id={`resposta-${topic}`}
                value={text}
                onChange={(value) => setDrafts((current) => ({ ...current, [topic]: value }))}
                rows={7}
                maxLength={2000}
                error={errors[topic]}
                hint={customised ? 'Este texto foi alterado por si e não muda quando atualiza o perfil.' : undefined}
              />
              <div className="acoes acoes--empilhar">
                <CopyButton text={text} label="Copiar resposta" variant="primary" />
                <Button onClick={() => save(topic, text)} disabled={!changed}>Guardar alteração</Button>
                <Button variant="quiet" onClick={() => reset(topic)} disabled={!changed && !customised}>Repor texto original</Button>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
