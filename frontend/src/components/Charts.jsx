import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const grid = '#e7e5e4'; const axis = { fontSize: 12, fill: '#78716c' };
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #e7e5e4', boxShadow: '0 8px 24px -12px rgba(0,0,0,.2)', fontSize: 12 } };
export const accentColor = () => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace(/ /g, ',') || '15,118,110'})`;
export const PALETTE = ['#0f766e', '#6366f1', '#d97706', '#e11d48', '#0ea5e9', '#84cc16'];

export function AreaTrend({ data, x, y, color = '#0f766e', format, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs><linearGradient id={`g-${y}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.35} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={format} />
        <Tooltip {...tip} formatter={(v) => (format ? format(v) : v)} /><Area type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} fill={`url(#g-${y})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function Bars({ data, x, ys, colors = PALETTE, format, height = 260, horizontal }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 20 : -10, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? <><XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={format} /><YAxis type="category" dataKey={x} width={110} tick={axis} tickLine={false} axisLine={false} /></> : <><XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={format} /></>}
        <Tooltip {...tip} formatter={(v) => (format ? format(v) : v)} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
        {ys.map((k, i) => <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} maxBarSize={36} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Lines({ data, x, ys, colors = PALETTE, height = 260, format }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={format} />
        <Tooltip {...tip} />{ys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, nameKey = 'name', valueKey = 'value', height = 220, colors = PALETTE }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart><Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none">{data.map((d, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip {...tip} /></PieChart>
    </ResponsiveContainer>
  );
}
export function RingProgress({ value = 0, size = 72, stroke = 8, label }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} stroke="#e7e5e4" strokeWidth={stroke} fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--accent))" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: 'stroke-dashoffset .6s' }} /></svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold">{label ?? `${value}%`}</span>
    </div>
  );
}
