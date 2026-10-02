import { BadgeEuro, ChevronRight, FileText, Settings, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/usePageTitle';
import './More.css';

const LINKS: { to: string; label: string; text: string; icon: LucideIcon }[] = [
  { to: '/orcamentos', label: 'Orçamentos', text: 'Fazer um orçamento em euros e descarregar em PDF.', icon: FileText },
  { to: '/definicoes', label: 'Definições', text: 'Perfil do negócio, serviços, preços e dados guardados.', icon: Settings },
  { to: '/planos', label: 'Planos', text: 'Plano gratuito e teste do Pro.', icon: BadgeEuro },
];

export default function More() {
  usePageTitle('Mais');
  return (
    <>
      <header className="pagina__cabecalho">
        <h1>Mais</h1>
      </header>
      <ul className="mais__lista">
        {LINKS.map(({ to, label, text, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="mais__ligacao">
              <Icon className="mais__icone" aria-hidden="true" />
              <span className="mais__texto">
                <span className="mais__rotulo">{label}</span>
                <span className="secundario pequeno">{text}</span>
              </span>
              <ChevronRight className="mais__seta" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
