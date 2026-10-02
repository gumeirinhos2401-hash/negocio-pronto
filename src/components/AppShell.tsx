import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopNav } from './TopNav';
import './AppShell.css';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // After a page change, start at the top and let screen readers land on the new content.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  // The router uses the URL hash, so the skip link moves focus itself instead of using an anchor.
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    main.current?.focus();
  };

  return (
    <div className="app">
      <a className="saltar" href="#conteudo" onClick={skipToContent}>Saltar para o conteúdo</a>
      <header className="app__topo">
        <div className="app__topo-interior">
          <Link to="/painel" className="app__marca">Negócio Pronto</Link>
          <TopNav />
        </div>
      </header>
      <main className="app__conteudo" id="conteudo" ref={main} tabIndex={-1}>
        <div className="app__pagina">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
