import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { Button } from '../ui';

export default function PublicLayout() {
  const user = useSelector((s) => s.auth.user);
  return (
    <div data-theme="student" className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white"><GraduationCap className="h-5 w-5" /></span><span className="font-display text-xl font-semibold">LearnSphere</span></Link>
          <nav className="flex items-center gap-1 sm:gap-3 text-sm font-semibold">
            <NavLink to="/courses" className="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100">Courses</NavLink>
            <NavLink to="/verify" className="hidden items-center gap-1 rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 sm:flex"><ShieldCheck className="h-4 w-4" />Verify certificate</NavLink>
            {user ? <Link to={`/${user.role}`}><Button size="sm">My dashboard</Button></Link> : <><Link to="/login" className="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100">Sign in</Link><Link to="/register"><Button size="sm">Get started</Button></Link></>}
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-stone-200 py-8 text-center text-sm text-stone-500">© {new Date().getFullYear()} LearnSphere · Full-Stack internship project FS-03</footer>
    </div>
  );
}
