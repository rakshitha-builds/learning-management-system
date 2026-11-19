import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { GraduationCap } from 'lucide-react';
import { useLoginMutation, useRegisterMutation } from '../../app/api';
import { setCredentials } from '../../app/authSlice';
import { addToast } from '../../app/uiSlice';
import { Button, Card, Input, cx } from '../../components/ui';
import { errMsg } from '../../lib/format';

const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v);
function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2">
      <div className="hidden md:block"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white"><GraduationCap className="h-6 w-6" /></span><h2 className="mt-6 font-display text-4xl font-semibold leading-tight">Learn something real, together with a live teacher.</h2><p className="mt-3 text-stone-500">Courses, live classes, quizzes and verifiable certificates in one place.</p></div>
      <Card className="p-7"><h1 className="font-display text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-stone-500">{subtitle}</p><div className="mt-6">{children}</div><div className="mt-5 text-center text-sm text-stone-500">{footer}</div></Card>
    </div>
  );
}

const DEMOS = [['Student', 'rakshitha@learnsphere.dev', 'Student@123'], ['Instructor', 'priya@learnsphere.dev', 'Instructor@123'], ['Admin', 'admin@learnsphere.dev', 'Admin@123']];

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' }); const [errors, setErrors] = useState({});
  const [login, { isLoading }] = useLoginMutation(); const dispatch = useDispatch(); const navigate = useNavigate(); const loc = useLocation();
  const submit = async (e) => {
    e.preventDefault();
    const er = {}; if (!emailOk(form.email)) er.email = 'Enter a valid email address'; if (!form.password) er.password = 'Password is required';
    setErrors(er); if (Object.keys(er).length) return;
    try { const r = await login(form).unwrap(); dispatch(setCredentials(r)); dispatch(addToast(`Welcome back, ${r.user.name.split(' ')[0]}!`)); navigate(loc.state?.from?.startsWith(`/${r.user.role}`) || loc.state?.from?.startsWith('/courses') ? loc.state.from : `/${r.user.role}`, { replace: true }); }
    catch (err) { setErrors({ form: errMsg(err) }); }
  };
  return (
    <Shell title="Sign in" subtitle="Welcome back to LearnSphere." footer={<>New here? <Link className="font-semibold text-accent" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{errors.form}</p>}
        <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" className="w-full" size="lg" loading={isLoading}>Sign in</Button>
      </form>
      <div className="mt-5 rounded-xl bg-stone-50 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Demo accounts (after seeding)</p><div className="mt-2 flex flex-wrap gap-2">{DEMOS.map(([r, e, p]) => <button key={r} type="button" onClick={() => setForm({ email: e, password: p })} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold hover:border-accent">{r}</button>)}</div></div>
    </Shell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' }); const [errors, setErrors] = useState({});
  const [register, { isLoading }] = useRegisterMutation(); const dispatch = useDispatch(); const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Name must be at least 2 characters';
    if (!emailOk(form.email)) er.email = 'Enter a valid email address';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) er.password = 'At least 8 characters with a letter and a number';
    setErrors(er); if (Object.keys(er).length) return;
    try { const r = await register(form).unwrap(); dispatch(setCredentials(r)); dispatch(addToast('Account created. Welcome to LearnSphere!')); navigate(`/${r.user.role}`, { replace: true }); }
    catch (err) { setErrors({ form: errMsg(err) }); }
  };
  return (
    <Shell title="Create your account" subtitle="Start learning or teaching in minutes." footer={<>Already have an account? <Link className="font-semibold text-accent" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{errors.form}</p>}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
          {[['student', 'I want to learn'], ['instructor', 'I want to teach']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={form.role === v} onClick={() => setForm({ ...form, role: v })} className={cx('rounded-lg border px-3 py-2.5 text-sm font-semibold transition', form.role === v ? 'border-accent bg-accent-soft text-accent-ink' : 'border-stone-300 hover:border-accent')}>{l}</button>)}
        </div>
        <Input label="Full name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} error={errors.password} hint="Minimum 8 characters, with a letter and a number." onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" className="w-full" size="lg" loading={isLoading}>Create account</Button>
      </form>
    </Shell>
  );
}
