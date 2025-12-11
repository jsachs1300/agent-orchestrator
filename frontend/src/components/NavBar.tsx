import { NavLink } from 'react-router-dom';

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="title">AI Git Agent Playground</div>
      <div className="nav-links">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          end
        >
          Playground
        </NavLink>
        <NavLink
          to="/config"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          Tool Config
        </NavLink>
      </div>
    </nav>
  );
}
