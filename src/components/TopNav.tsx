import { NavLink } from 'react-router-dom';
import { TOP_NAV } from './navItems';
import './TopNav.css';

export function TopNav() {
  return (
    <nav className="nav-topo" aria-label="Principal">
      <ul className="nav-topo__lista">
        {TOP_NAV.map((item) => (
          <li key={item.to}>
            {/* NavLink sets aria-current="page" on the active link. */}
            <NavLink to={item.to} className="nav-topo__ligacao">{item.label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
