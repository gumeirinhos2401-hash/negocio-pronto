import { EmptyState } from '../components/EmptyState';
import { usePageTitle } from '../components/usePageTitle';

export default function NotFound() {
  usePageTitle('Página não encontrada');
  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Página não encontrada</h1>
      </header>
      <EmptyState
        title="Este endereço não existe"
        text="O link pode estar errado ou a página pode ter mudado de sítio. Os seus dados continuam guardados."
        action={{ label: 'Ir para o painel', to: '/painel' }}
      />
    </>
  );
}
