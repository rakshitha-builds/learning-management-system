import { Link } from 'react-router-dom';
import { Award, PlayCircle, Radio, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui';
import Catalog from './Catalog';

const features = [
  { icon: PlayCircle, title: 'Adaptive video lessons', text: 'Every upload is transcoded by FFmpeg into streaming HLS and delivered securely.' },
  { icon: Radio, title: 'Real live classes', text: 'Join instructors in real-time audio/video with chat, powered by LiveKit and WebRTC.' },
  { icon: ShieldCheck, title: 'Auto-graded quizzes', text: 'Timed multiple-choice quizzes with instant, server-side scoring and review.' },
  { icon: Award, title: 'Verifiable certificates', text: 'Complete a course to earn a PDF certificate with a unique, publicly verifiable ID.' },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-stone-200 bg-[#0c2f2c] text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" /><div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
          <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-200">Learn live · Learn on your time</p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.08] sm:text-6xl">A full online school: courses, live classes and certificates.</h1>
          <p className="mt-5 max-w-xl text-lg text-teal-50/80">Learn from working engineers through recorded lessons and live sessions, test yourself with quizzes, and earn certificates you can verify.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#catalog"><Button size="lg" className="!bg-white !text-teal-900">Browse courses</Button></a><Link to="/register"><Button size="lg" variant="ghost" className="!text-white ring-1 ring-white/30 hover:!bg-white/10">Teach on LearnSphere</Button></Link></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink"><f.icon className="h-5 w-5" /></span><h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3><p className="mt-1 text-sm text-stone-500">{f.text}</p></div>
        ))}
      </section>
      <Catalog />
    </>
  );
}
