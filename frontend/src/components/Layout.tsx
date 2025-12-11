import { ReactNode } from 'react';
import NavBar from './NavBar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-container">
      <NavBar />
      <main className="main-content">{children}</main>
    </div>
  );
}
