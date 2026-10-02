import { useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Tag } from '../components/Tag';
import { useToast } from '../components/Toast';
import { useNow } from '../components/useNow';
import { usePageTitle } from '../components/usePageTitle';
import { formatEuros } from '../domain/money';
import { FREE_POST_LIMIT, planStatus, PRO_PRICE_CENTS, TRIAL_DAYS } from '../domain/plan';
import { usePlan } from '../storage/areas';
import './Plans.css';

const SIMULATION_LABEL = 'Simulação: nenhum pagamento é cobrado';

export default function Plans() {
  usePageTitle('Planos');
  const toast = useToast();
  const [plan, setPlan] = usePlan();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const now = useNow();

  const status = planStatus(plan, now);
  const onTrial = status.kind === 'teste';
  const trialUsed = plan.trialStartedAt !== null && !onTrial;
  const price = formatEuros(PRO_PRICE_CENTS);

  const startTrial = () => {
    const saved = setPlan({ tier: 'pro', trialStartedAt: new Date().toISOString() });
    setCheckoutOpen(false);
    if (saved) toast.show('Teste iniciado');
  };

  const endTrial = () => {
    const saved = setPlan({ tier: 'gratuito', trialStartedAt: plan.trialStartedAt });
    // The button that was pressed is replaced, so focus moves to the plan heading.
    document.getElementById('plano-pro')?.focus();
    if (saved) toast.show('Teste terminado');
  };

  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Planos</h1>
        <p className="pagina__intro">
          O plano gratuito chega para começar. O Pro pode ser experimentado durante {TRIAL_DAYS} dias. Nesta versão não há pagamentos reais.
        </p>
      </header>

      <div className="planos__grelha">
        <section className="planos__plano" aria-labelledby="plano-gratuito">
          <div className="planos__topo">
            <h2 id="plano-gratuito">Gratuito</h2>
            {!onTrial && <Tag tone="accent">O seu plano</Tag>}
          </div>
          <p className="planos__preco">{formatEuros(0)}</p>
          <ul className="planos__lista">
            <li>{FREE_POST_LIMIT} publicações guardadas por mês</li>
            <li>Gerar e copiar textos sem limite</li>
            <li>Calendário, respostas e orçamentos</li>
          </ul>
          {status.kind === 'teste-terminado' && (
            <p className="secundario">O teste do Pro terminou e voltou a este plano.</p>
          )}
        </section>

        <section className="planos__plano planos__plano--pro" aria-labelledby="plano-pro">
          <div className="planos__topo">
            <h2 id="plano-pro" className="planos__foco" tabIndex={-1}>Pro</h2>
            {onTrial && <Tag tone="accent">Em teste</Tag>}
          </div>
          <p className="planos__preco">
            {price} <span className="planos__periodo">por mês</span>
          </p>
          <ul className="planos__lista">
            <li>Publicações guardadas sem limite</li>
            <li>Tudo o que o plano gratuito inclui</li>
            <li>Teste gratuito de {TRIAL_DAYS} dias</li>
          </ul>
          {onTrial ? (
            <>
              <p className="planos__estado" role="status">
                {status.daysLeft === 1 ? 'Falta 1 dia de teste.' : `Faltam ${status.daysLeft} dias de teste.`} Quando terminar, volta ao plano gratuito e nada é cobrado.
              </p>
              <div>
                <Button onClick={endTrial}>Terminar teste</Button>
              </div>
            </>
          ) : trialUsed ? (
            <p className="planos__estado">O teste gratuito já foi usado nesta conta.</p>
          ) : (
            <>
              <div>
                <Button variant="primary" onClick={() => setCheckoutOpen(true)}>Experimentar o Pro</Button>
              </div>
              <p className="secundario pequeno">{SIMULATION_LABEL}.</p>
            </>
          )}
        </section>
      </div>

      <Dialog open={checkoutOpen} title="Experimentar o Pro" onClose={() => setCheckoutOpen(false)}>
        <p className="planos__simulacao">{SIMULATION_LABEL}</p>
        <p>
          Esta versão da Negócio Pronto não tem pagamentos. Não pedimos cartão nem dados bancários.
        </p>
        <dl className="planos__resumo">
          <div>
            <dt>Plano</dt>
            <dd>Pro, {price} por mês</dd>
          </div>
          <div>
            <dt>Teste gratuito</dt>
            <dd>{TRIAL_DAYS} dias</dd>
          </div>
          <div>
            <dt>A pagar hoje</dt>
            <dd>{formatEuros(0)}</dd>
          </div>
        </dl>
        <p className="secundario pequeno">Ao fim de {TRIAL_DAYS} dias o teste termina sozinho e volta ao plano gratuito.</p>
        <div className="dialogo__acoes">
          <Button onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={startTrial}>Iniciar teste (simulação)</Button>
        </div>
      </Dialog>
    </>
  );
}
