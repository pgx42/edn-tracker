// EDN Tracker — Dashboard, Library, Calendar, Mindmaps stub views
const { useState: _useStateV } = React;

// ---------------------------------------------------------------- Dashboard
function Dashboard() {
  return (
    <div style={dashStyles.root}>
      <div style={dashStyles.heroRow}>
        <div style={dashStyles.heroCard}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Aujourd'hui</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div className="display" style={{ fontSize: 56, lineHeight: 1 }}>42</div>
            <div style={{ fontSize: 14, color: 'var(--fg-2)' }}>cartes en retard</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 8 }}>12 minutes pour rattraper. Reprends là où tu t'es arrêté.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={dashStyles.btnPrimary}>Réviser maintenant</button>
            <button style={dashStyles.btnSecondary}>Plus tard</button>
          </div>
        </div>
        <div style={dashStyles.statGrid}>
          {[
            { label: 'Streak', value: '14', sub: 'jours', tone: 'success' },
            { label: 'Cartes vues', value: '1 248', sub: 'cette semaine' },
            { label: 'Précision', value: '78%', sub: '+4 vs sem. dernière', tone: 'info' },
            { label: 'Erreurs', value: '7', sub: 'à retravailler', tone: 'danger' },
          ].map(s => (
            <div key={s.label} style={dashStyles.statCard}>
              <div style={dashStyles.statLabel}>{s.label}</div>
              <div style={dashStyles.statValue}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.tone === 'danger' ? 'var(--danger-fg)' : s.tone === 'success' ? 'var(--success-fg)' : 'var(--fg-3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={dashStyles.colsRow}>
        <div style={dashStyles.col}>
          <div style={dashStyles.colHead}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>File du jour</h3>
            <span className="meta">par item</span>
          </div>
          {[
            { item: '334', name: 'Syndrome coronarien aigu', count: 12, due: 'maintenant' },
            { item: '232', name: 'Diabète sucré type 1 et 2', count: 8, due: 'maintenant' },
            { item: '102', name: 'Sclérose en plaques', count: 14, due: '1 h' },
            { item: '226', name: 'Embolie pulmonaire', count: 6, due: '3 h' },
            { item: '328', name: 'Insuffisance cardiaque', count: 2, due: 'demain' },
          ].map((q, i) => (
            <div key={i} style={dashStyles.queueRow}>
              <div style={dashStyles.itemBadge}>{q.item}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</div>
                <div className="meta">{q.count} cartes · dû {q.due}</div>
              </div>
              <button style={dashStyles.miniBtn}>Réviser</button>
            </div>
          ))}
        </div>

        <div style={dashStyles.col}>
          <div style={dashStyles.colHead}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Activité récente</h3>
            <span className="meta">7 derniers jours</span>
          </div>
          <div style={dashStyles.heatmap}>
            {Array.from({ length: 7 * 12 }).map((_, i) => {
              const v = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * 0.5 + 0.5;
              const intensity = Math.max(0, Math.min(1, v));
              return <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: 3, background: intensity < 0.15 ? 'var(--bg-sunken)' : `rgba(37, 99, 235, ${0.15 + intensity * 0.85})` }} />;
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-3)' }}>
            <span>Moins</span>
            {[0.1, 0.3, 0.5, 0.7, 0.95].map((v, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: v < 0.15 ? 'var(--bg-sunken)' : `rgba(37, 99, 235, ${v})` }} />)}
            <span>Plus</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { ico: 'highlighter', text: 'Annoté Cardio.pdf — p. 42', time: 'il y a 12 min' },
              { ico: 'check-circle-2', text: 'Session Anki · 28 cartes · 92%', time: 'il y a 1 h' },
              { ico: 'alert-triangle', text: 'Erreur ajoutée — item 232', time: 'il y a 3 h' },
              { ico: 'git-branch', text: 'Mindmap "Cycle ovarien" mise à jour', time: 'hier' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--fg-muted)' }}><Icon name={a.ico} size={14} /></span>
                <span style={{ color: 'var(--fg-1)', flex: 1 }}>{a.text}</span>
                <span className="meta">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const dashStyles = {
  root: { padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 },
  heroRow: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 },
  heroCard: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  statCard: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  statValue: { fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' },
  btnPrimary: { height: 32, padding: '0 14px', background: 'var(--accent)', color: '#fff', border: 0, borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnSecondary: { height: 32, padding: '0 14px', background: 'var(--bg-surface)', color: 'var(--fg-1)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' },
  colsRow: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 },
  col: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  colHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  queueRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderRadius: 'var(--radius-sm)' },
  itemBadge: { fontSize: 11, fontWeight: 600, color: 'var(--accent-fg)', background: 'var(--accent-bg)', padding: '2px 7px', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-mono)' },
  miniBtn: { height: 24, padding: '0 8px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' },
  heatmap: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 },
};

// ---------------------------------------------------------------- Library
function Library() {
  const items = [
    { type: 'pdf', icon: 'file-text', name: 'Cardio — ECN polycopié 2024.pdf', tag: 'Cardiologie', meta: '128 p · annoté · il y a 2 j' },
    { type: 'fiche', icon: 'book-open', name: 'Fiche révision — diabète', tag: 'Endocrinologie', meta: '4 p · à jour' },
    { type: 'pdf', icon: 'file-text', name: 'Conférence Khalifa — Neuro.pdf', tag: 'Neurologie', meta: '54 p · 18 highlights' },
    { type: 'deck', icon: 'layers', name: 'Anki — pharmacologie cardio', tag: 'Cardiologie', meta: '342 cartes' },
    { type: 'mindmap', icon: 'git-branch', name: 'Cycle menstruel — vue intégrée', tag: 'Gynécologie', meta: '24 nœuds' },
    { type: 'pdf', icon: 'file-text', name: 'Item 232 — diabète sucré.pdf', tag: 'Endocrinologie', meta: '32 p' },
    { type: 'fiche', icon: 'book-open', name: 'Carnet — erreurs SCA', tag: 'Cardiologie', meta: '7 entrées' },
  ];
  return (
    <div style={libStyles.root}>
      <div style={libStyles.toolbar}>
        <div style={libStyles.tabs}>
          {['Tout', 'PDFs', 'Fiches', 'Anki', 'Mindmaps'].map((t, i) => (
            <button key={t} style={{ ...libStyles.tab, ...(i === 0 ? libStyles.tabActive : {}) }}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button style={libStyles.btnPrimary}><Icon name="plus" size={14} /><span>Importer</span></button>
      </div>
      <div style={libStyles.table}>
        <div style={libStyles.thead}>
          <div style={{ flex: 1 }}>Nom</div>
          <div style={{ width: 140 }}>Étiquette</div>
          <div style={{ width: 200 }}>Détails</div>
        </div>
        {items.map((it, i) => (
          <div key={i} style={libStyles.row}>
            <span style={{ color: 'var(--fg-muted)' }}><Icon name={it.icon} size={16} /></span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{it.name}</div>
            <div style={{ width: 140 }}>
              <span style={libStyles.tag}>{it.tag}</span>
            </div>
            <div style={{ width: 200, fontSize: 12, color: 'var(--fg-3)' }}>{it.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
const libStyles = {
  root: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8 },
  tabs: { display: 'flex', gap: 0, background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 3 },
  tab: { padding: '5px 12px', fontSize: 12, color: 'var(--fg-2)', background: 'transparent', border: 0, borderRadius: 4, cursor: 'pointer' },
  tabActive: { background: 'var(--bg-surface)', color: 'var(--fg-1)', fontWeight: 500, boxShadow: 'var(--shadow-sm)' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', background: 'var(--accent)', color: '#fff', border: 0, borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  table: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  thead: { display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px 8px 44px', fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sunken)' },
  row: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' },
  tag: { fontSize: 11, color: 'var(--fg-2)', background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-xs)' },
};

// ---------------------------------------------------------------- Calendar
function Calendar() {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const dates = ['28', '29', '30', '01', '02', '03', '04'];
  const today = 1;
  const slots = [
    { day: 0, time: '07:00', dur: 1.5, label: 'Anki cardio', count: 42, tone: 'danger' },
    { day: 0, time: '14:00', dur: 2, label: 'PDF — neuro', tone: 'info' },
    { day: 1, time: '08:00', dur: 1, label: 'Anki cardio', count: 18, tone: 'accent' },
    { day: 1, time: '10:00', dur: 1.5, label: 'Carnet erreurs', tone: 'warning' },
    { day: 2, time: '09:00', dur: 2, label: 'Mindmap endocrino', tone: 'info' },
    { day: 3, time: '08:00', dur: 1, label: 'Anki cardio', count: 14, tone: 'accent' },
    { day: 3, time: '13:00', dur: 1.5, label: 'PDF — gynéco', tone: 'info' },
    { day: 4, time: '09:00', dur: 2, label: 'Conférence — pneumo', tone: 'success' },
    { day: 5, time: '10:00', dur: 1, label: 'Anki rattrapage', count: 22, tone: 'accent' },
    { day: 6, time: '15:00', dur: 1.5, label: 'Bilan semaine', tone: 'success' },
  ];
  const tone = (t) => ({
    accent: { bg: 'var(--accent-bg)', fg: 'var(--accent-fg)', border: 'var(--accent-border)' },
    danger: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', border: 'var(--danger-border)' },
    warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', border: 'var(--warning-border)' },
    success: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', border: 'var(--success-border)' },
    info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', border: 'var(--info-border)' },
  }[t]);
  return (
    <div style={calStyles.root}>
      <div style={calStyles.toolbar}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Avril 2026</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={calStyles.iconBtn}><Icon name="chevron-left" size={14} /></button>
          <button style={calStyles.todayBtn}>Aujourd'hui</button>
          <button style={calStyles.iconBtn}><Icon name="chevron-right" size={14} /></button>
        </div>
      </div>
      <div style={calStyles.grid}>
        <div style={calStyles.timeCol}>
          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
            <div key={h} style={calStyles.timeRow}><span className="meta">{String(h).padStart(2, '0')}:00</span></div>
          ))}
        </div>
        {days.map((d, di) => (
          <div key={di} style={calStyles.dayCol}>
            <div style={{ ...calStyles.dayHead, ...(di === today ? calStyles.dayHeadToday : {}) }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{d}</span>
              <span style={{ fontSize: 16, fontWeight: di === today ? 600 : 500, color: di === today ? 'var(--accent)' : 'var(--fg-1)' }}>{dates[di]}</span>
            </div>
            <div style={calStyles.dayBody}>
              {slots.filter(s => s.day === di).map((s, si) => {
                const t = tone(s.tone);
                const top = (parseInt(s.time.split(':')[0]) - 7) * 48;
                return (
                  <div key={si} style={{ position: 'absolute', top, left: 4, right: 4, height: s.dur * 48 - 4, background: t.bg, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.fg}`, borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: 11, color: t.fg, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{s.label}</div>
                    {s.count != null && <div style={{ fontSize: 10, opacity: 0.85 }}>{s.count} cartes</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const calStyles = {
  root: { padding: 24, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBtn: { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--fg-2)' },
  todayBtn: { height: 28, padding: '0 12px', background: 'var(--bg-surface)', color: 'var(--fg-1)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' },
  timeCol: { paddingTop: 56, borderRight: '1px solid var(--border-subtle)' },
  timeRow: { height: 48, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 6, paddingTop: 2 },
  dayCol: { borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' },
  dayHead: { padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 },
  dayHeadToday: { background: 'var(--accent-bg)' },
  dayBody: { position: 'relative', height: 12 * 48, backgroundImage: 'linear-gradient(to bottom, transparent 47px, var(--border-subtle) 47px, var(--border-subtle) 48px)', backgroundSize: '100% 48px' },
};

Object.assign(window, { Dashboard, Library, Calendar });
