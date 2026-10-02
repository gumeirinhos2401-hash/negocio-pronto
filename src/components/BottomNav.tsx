import { NavLink, useLocation } from 'react-router-dom';
import { BOTTOM_NAV, MORE_ROUTES } from './navItems';
import './BottomNav.css';

export function BottomNav() {
  const { pathname } = useLocation();
  const insideMore = MORE_ROUTES.includes(pathname);
  return (
    <nav className="nav-fundo" aria-label="Principal">
      <ul className="nav-fundo__lista">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={`nav-fundo__ligacao${to === '/mais' && insideMore ? ' nav-fundo__ligacao--ativa' : ''}`}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
