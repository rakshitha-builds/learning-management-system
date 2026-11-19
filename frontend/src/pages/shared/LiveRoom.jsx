import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LiveKitRoom, GridLayout, ParticipantTile, ControlBar, RoomAudioRenderer, useTracks, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { AlertTriangle, MessageSquare, Radio, Send, Users, Video } from 'lucide-react';
import { useEndLiveMutation, useLiveGetQuery, useLiveMessagesQuery, useLiveTokenMutation, useStartLiveMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Badge, Button, Card, PageLoader, StatusBadge, cx } from '../../components/ui';
import { connectSocket } from '../../lib/socket';
import { dateTime, errMsg } from '../../lib/format';

function Stage() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  return <GridLayout tracks={tracks} style={{ height: 'calc(100% - 64px)' }}><ParticipantTile /></GridLayout>;
}

function People({ hostId }) {
  const parts = useParticipants();
  return (
    <ul className="divide-y divide-stone-100">
      {parts.map((p) => (
        <li key={p.identity} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">{(p.name || '?')[0]}</span><span className="flex-1 truncate font-medium">{p.name}{p.isLocal && ' (you)'}</span>{p.identity === hostId && <Badge tone="accent">host</Badge>}<span className={cx('text-xs', p.isMicrophoneEnabled ? 'text-emerald-600' : 'text-stone-400')}>{p.isMicrophoneEnabled ? 'mic on' : 'muted'}</span></li>
      ))}
    </ul>
  );
}

function Chat({ liveClassId, onEnded }) {
  const token = useSelector((s) => s.auth.token); const me = useSelector((s) => s.auth.user);
  const hist = useLiveMessagesQuery(liveClassId);
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const [online, setOnline] = useState(0); const [status, setStatus] = useState('connecting');
  const sock = useRef(null); const end = useRef(null);
  useEffect(() => { if (hist.data) setMsgs((m) => { const ids = new Set(m.map((x) => x._id)); return [...hist.data.filter((x) => !ids.has(x._id)), ...m]; }); }, [hist.data]);
  useEffect(() => {
    const s = connectSocket(token); sock.current = s;
    s.on('connect', () => s.emit('chat:join', { liveClassId }, (r) => setStatus(r?.ok ? 'online' : 'denied')));
    s.on('disconnect', () => setStatus('connecting'));
    s.on('chat:message', (m) => setMsgs((x) => (x.some((y) => y._id === m._id) ? x : [...x, m])));
    s.on('chat:presence', (p) => setOnline(p.count)); s.on('live:ended', onEnded);
    return () => s.disconnect();
  }, [liveClassId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const send = (e) => { e.preventDefault(); const t = text.trim(); if (!t) return; sock.current.emit('chat:message', { liveClassId, message: t }, (r) => { if (!r?.ok) console.warn(r?.error); }); setText(''); };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-500"><span>{status === 'online' ? `${online} in chat` : status === 'denied' ? 'Chat unavailable' : 'Connecting…'}</span><span className={cx('h-2 w-2 rounded-full', status === 'online' ? 'bg-emerald-500' : 'bg-stone-300')} /></div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-2 scrollbar-thin">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-stone-400">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => (<div key={m._id} className={cx('flex flex-col', String(m.sender) === me._id ? 'items-end' : 'items-start')}><span className="text-[11px] font-semibold text-stone-500">{m.senderName}{m.senderRole === 'instructor' && <span className="ml-1 text-accent">• instructor</span>}</span><span className={cx('mt-0.5 max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm', String(m.sender) === me._id ? 'bg-accent text-white' : 'bg-stone-100')}>{m.message}</span></div>))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-stone-200 p-3"><input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Chat message" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" /><Button type="submit" aria-label="Send" disabled={status !== 'online'}><Send className="h-4 w-4" /></Button></form>
    </div>
  );
}

export default function LiveRoom() {
  const { id } = useParams(); const navigate = useNavigate(); const dispatch = useDispatch(); const user = useSelector((s) => s.auth.user);
  const lc = useLiveGetQuery(id, { pollingInterval: 6000 });
  const [getToken, { isLoading: joining }] = useLiveTokenMutation(); const [start, { isLoading: starting }] = useStartLiveMutation(); const [stop, { isLoading: ending }] = useEndLiveMutation();
  const [conn, setConn] = useState(null); const [error, setError] = useState(''); const [side, setSide] = useState('chat');
  const back = `/${user.role}/live`;

  const join = async () => { setError(''); try { setConn(await getToken(id).unwrap()); } catch (e) { setError(errMsg(e)); } };
  const goLive = async () => { try { await start(id).unwrap(); dispatch(addToast('Class is live!')); await join(); } catch (e) { setError(errMsg(e)); } };
  const endClass = async () => { try { await stop(id).unwrap(); dispatch(addToast('Class ended')); setConn(null); navigate(back); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  const ended = () => { dispatch(addToast('The instructor ended this class.', 'info')); setConn(null); };

  if (lc.isLoading) return <PageLoader />;
  if (lc.isError) return <Card className="p-8 text-center text-stone-500">{lc.error?.data?.message || 'Live class not found'}<div className="mt-4"><Link to={back}><Button variant="secondary">Back</Button></Link></div></Card>;
  const c = lc.data;

  if (!conn) return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink">{c.status === 'live' ? <Radio className="h-7 w-7" /> : <Video className="h-7 w-7" />}</span>
      <div className="mt-3"><StatusBadge status={c.status} /></div><h1 className="mt-3 font-display text-2xl font-semibold">{c.title}</h1><p className="mt-1 text-stone-500">{c.course?.title} · {c.instructor?.name}</p><p className="mt-1 text-sm text-stone-500">{dateTime(c.scheduledAt)} · {c.durationMinutes} min</p>
      {error && <div role="alert" className="mx-auto mt-5 flex max-w-md items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {c.isHost && c.status === 'scheduled' && <Button size="lg" loading={starting} onClick={goLive} icon={Radio}>Start class</Button>}
        {c.status === 'live' && <Button size="lg" loading={joining} onClick={join} icon={Video}>{c.isHost ? 'Rejoin as host' : 'Join class'}</Button>}
        {!c.isHost && c.status === 'scheduled' && <p className="text-sm text-stone-500">Waiting for the instructor to start the class…</p>}
        {(c.status === 'ended' || c.status === 'cancelled') && <p className="text-sm text-stone-500">This class is {c.status}.</p>}
        <Link to={back}><Button size="lg" variant="secondary">Back to classes</Button></Link>
      </div>
    </Card>
  );

  return (
    <LiveKitRoom token={conn.token} serverUrl={conn.url} connect video={conn.isHost} audio={conn.isHost} data-lk-theme="default" onDisconnected={() => setConn(null)} onError={(e) => setError(e.message)} className="!block">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h1 className="font-display text-xl font-semibold">{c.title}</h1><p className="text-sm text-stone-500">{c.course?.title}</p></div>{conn.isHost && <Button variant="danger" loading={ending} onClick={endClass}>End class for everyone</Button>}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[62vh] min-h-[360px] overflow-hidden rounded-2xl bg-slate-900"><Stage /><ControlBar variation="verbose" controls={{ chat: false, settings: false }} /></div>
        <Card className="flex h-[62vh] min-h-[360px] flex-col overflow-hidden">
          <div className="flex border-b border-stone-200">{[['chat', 'Chat', MessageSquare], ['people', 'Participants', Users]].map(([k, l, I]) => <button key={k} onClick={() => setSide(k)} className={cx('flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold', side === k ? 'border-accent text-accent-ink' : 'border-transparent text-stone-500')}><I className="h-4 w-4" />{l}</button>)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{side === 'chat' ? <Chat liveClassId={id} onEnded={ended} /> : <People hostId={String(c.instructor?._id)} />}</div>
        </Card>
      </div>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
