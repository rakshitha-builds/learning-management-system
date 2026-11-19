import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Award, Bell, BookOpen, CreditCard, GraduationCap, LayoutDashboard, LogOut, Menu, Radio, Receipt, Search, ShieldCheck, Users, X, ListChecks, Activity, UserCog, Wallet, Library, FileQuestion, UserCircle } from 'lucide-react';
import { logout } from '../../app/authSlice';
import { setSidebar } from '../../app/uiSlice';
import { api, useMarkAllReadMutation, useMarkReadMutation, useNotificationsQuery } from '../../app/api';
import { cx } from '../ui';
import { initials, dateTime } from '../../lib/format';

// Each role has its own navigation AND its own visual treatment.
const ROLES = {
  student: {
    label: 'Student', home: '/student', shell: 'bg-white border-r border-stone-200', brand: 'text-ink', item: 'text-stone-600 hover:bg-stone-100', active: 'bg-accent-soft text-accent-ink', muted: 'text-stone-400',
    nav: [
      { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/student/courses', label: 'My learning', icon: BookOpen }, { to: '/courses', label: 'Browse courses', icon: Search },
      { to: '/student/live', label: 'Live classes', icon: Radio }, { to: '/student/quizzes', label: 'Quiz results', icon: FileQuestion }, { to: '/student/certificates', label: 'Certificates', icon: Award }, { to: '/student/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  instructor: {
    label: 'Instructor studio', home: '/instructor', shell: 'bg-[#1e1b4b] text-indigo-100', brand: 'text-white', item: 'text-indigo-200 hover:bg-white/10', active: 'bg-white/15 text-white', muted: 'text-indigo-300/60',
    nav: [
      { to: '/instructor', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/instructor/courses', label: 'My courses', icon: Library }, { to: '/instructor/students', label: 'Students', icon: Users },
      { to: '/instructor/live', label: 'Live classes', icon: Radio }, { to: '/instructor/revenue', label: 'Revenue', icon: Wallet },
    ],
  },
  admin: {
    label: 'Admin console', home: '/admin', shell: 'bg-stone-900 text-stone-300', brand: 'text-white', item: 'text-stone-400 hover:bg-white/10', active: 'bg-amber-500/15 text-amber-300', muted: 'text-stone-500',
    nav: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/admin/users', label: 'Users', icon: UserCog }, { to: '/admin/courses', label: 'Courses', icon: ShieldCheck },
      { to: '/admin/enrollments', label: 'Enrollments', icon: ListChecks }, { to: '/admin/transactions', label: 'Transactions', icon: Receipt }, { to: '/admin/activity', label: 'Activity', icon: Activity },
    ],
  },
};

function NotificationBell({ role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { data } = useNotificationsQuery(undefined, { pollingInterval: 30000 });
  const [markRead] = useMarkReadMutation(); const [markAll] = useMarkAllReadMutation();
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100">
        <Bell className="h-5 w-5" />{data?.unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="fade-in absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><span className="text-sm font-semibold">Notifications</span>{data?.unread > 0 && <button className="text-xs font-semibold text-accent" onClick={() => markAll()}>Mark all read</button>}</div>
          <div className="max-h-80 overflow-y-auto">
            {!data?.items?.length ? <p className="p-6 text-center text-sm text-stone-500">You’re all caught up.</p> : data.items.slice(0, 12).map((n) => (
              <button key={n._id} onClick={() => { markRead(n._id); setOpen(false); if (n.link) navigate(n.link.startsWith('/student') || n.link.startsWith('/instructor') || n.link.startsWith('/admin') || n.link.startsWith('/courses') ? n.link : `/${role}`); }} className={cx('block w-full border-b border-stone-50 px-4 py-3 text-left hover:bg-stone-50', !n.read && 'bg-accent-soft/40')}>
                <p className="text-sm font-semibold">{n.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{n.message}</p><p className="mt-1 text-[11px] text-stone-400">{dateTime(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const user = useSelector((s) => s.auth.user);
  const open = useSelector((s) => s.ui.sidebarOpen);
  const dispatch = useDispatch(); const navigate = useNavigate(); const { pathname } = useLocation();
  const cfg = ROLES[user.role];
  useEffect(() => { dispatch(setSidebar(false)); }, [pathname, dispatch]);

  const sidebar = (
    <aside className={cx('flex h-full w-64 flex-col', cfg.shell)}>
      <Link to={cfg.home} className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white"><GraduationCap className="h-5 w-5" /></span>
        <span><span className={cx('block font-display text-lg font-semibold leading-none', cfg.brand)}>LearnSphere</span><span className={cx('text-[11px] font-medium uppercase tracking-widest', cfg.muted)}>{cfg.label}</span></span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {cfg.nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition', isActive && n.to !== '/courses' ? cfg.active : cfg.item)}>
            <n.icon className="h-[18px] w-[18px]" />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink to={`${cfg.home}/account`} className={cx('flex items-center gap-3 rounded-lg px-3 py-2.5', cfg.item)}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-white">{initials(user.name)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name}</span><span className={cx('block truncate text-xs', cfg.muted)}>{user.email}</span></span>
        </NavLink>
        <button onClick={() => { dispatch(logout()); dispatch(api.util.resetApiState()); navigate('/login'); }} className={cx('mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold', cfg.item)}><LogOut className="h-[18px] w-[18px]" />Sign out</button>
      </div>
    </aside>
  );

  return (
    <div data-theme={user.role} className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">{sidebar}</div>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink/50" onClick={() => dispatch(setSidebar(false))} /><div className="relative h-full w-64">{sidebar}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-8">
          <button className="rounded-lg p-2 hover:bg-stone-100 lg:hidden" onClick={() => dispatch(setSidebar(!open))} aria-label="Toggle menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <div className="hidden text-sm text-stone-500 lg:block">Signed in as <strong className="text-ink">{user.name}</strong></div>
          <div className="flex items-center gap-1"><NotificationBell role={user.role} /><NavLink to={`${cfg.home}/account`} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Account"><UserCircle className="h-5 w-5" /></NavLink></div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8"><div className="fade-in mx-auto max-w-7xl"><Outlet /></div></main>
      </div>
    </div>
  );
}
