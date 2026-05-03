// EDN Tracker — Command Palette + Search graph view + Mindmaps index

function CommandPalette({ open, onClose }) {
  if (!open) return null;
  const groups = [
    { label: 'Actions', items: [
      { ico: 'play', label: 'Reprendre la révision', kbd: '↵' },
      { ico: 'plus', label: 'Nouvelle carte', kbd: '⌘N' },
      { ico: 'file-text', label: 'Importer un PDF' },
    ]},
    { label: 'Aller à', items: [
      { ico: 'sun', label: "Aujourd'hui" },
      { ico: 'layers', label: 'Anki — pharmacologie cardio' },
      { ico: 'book-open', label: 'Cardio — ECN polycopié 2024' },
      { ico: 'git-branch', label: 'Mindmap — cycle ovarien' },
    ]},
    { label: 'Récents', items: [
      { ico: 'highlighter', label: 'Annotation — p. 42' },
      { ico: 'alert-triangle', label: 'Erreur item 232' },
    ]},
  ];
  return (
    <div onClick={onClose} style={cpStyles.scrim}>
      <div onClick={e => e.stopPropagation()} style={cpStyles.modal}>
        <div style={cpStyles.searchRow}>
          <Icon name="search" size={16} style={{ color: 'var(--fg-muted)' }} />
          <input autoFocus placeholder="Que veux-tu faire ?" style={cpStyles.input} />
          <span style={cpStyles.kbd}>esc</span>
        </div>
        <div style={cpStyles.list}>
          {groups.map((g, gi) => (
            <div key={gi} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={cpStyles.groupLabel}>{g.label}</div>
              {g.items.map((it, i) => (
                <div key={i} style={{ ...cpStyles.row, ...(gi === 0 && i === 0 ? cpStyles.rowActive : {}) }}>
                  <Icon name={it.ico} size={14} />
                  <span style={{ flex: 1, fontSize: 13 }}>{it.label}</span>
                  {it.kbd && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{it.kbd}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={cpStyles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> sélectionner</span>
          <span style={{ marginLeft: 'auto' }}>Recherche globale dans 1 248 éléments</span>
        </div>
      </div>
    </div>
  );
}
const cpStyles = {
  scrim: { position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, zIndex: 100 },
  modal: { width: 560, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  searchRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' },
  input: { flex: 1, border: 0, outline: 0, fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--fg-1)', background: 'transparent' },
  kbd: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', padding: '2px 6px', background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)' },
  list: { padding: 6, maxHeight: 360, overflowY: 'auto' },
  groupLabel: { fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--fg-1)', cursor: 'pointer' },
  rowActive: { background: 'var(--bg-selected)', color: 'var(--accent-fg)' },
  footer: { display: 'flex', gap: 14, padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--fg-3)' },
};

// ---------------------------------------------------------------- Mindmaps grid
function Mindmaps() {
  const maps = [
    { name: 'Cycle ovarien — vue intégrée', nodes: 24, tag: 'Gynécologie' },
    { name: 'Conduction cardiaque', nodes: 18, tag: 'Cardiologie' },
    { name: 'Voies de la douleur', nodes: 32, tag: 'Neurologie' },
    { name: 'Insulinorésistance', nodes: 14, tag: 'Endocrinologie' },
    { name: 'Hémostase primaire et secondaire', nodes: 28, tag: 'Hémato' },
    { name: 'Item 102 — SEP', nodes: 22, tag: 'Neurologie' },
  ];
  return (
    <div style={mmStyles.root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={dashStyles.btnPrimary}><Icon name="plus" size={14} />&nbsp;Nouveau canvas</button>
        <span className="meta" style={{ marginLeft: 'auto' }}>{maps.length} mindmaps</span>
      </div>
      <div style={mmStyles.grid}>
        {maps.map((m, i) => (
          <div key={i} style={mmStyles.card}>
            <div style={mmStyles.thumb}>
              {/* Faux mindmap thumbnail */}
              <svg viewBox="0 0 200 120" width="100%" height="100%">
                <line x1="100" y1="60" x2="40" y2="30" stroke="var(--border-default)" strokeWidth="1"/>
                <line x1="100" y1="60" x2="40" y2="90" stroke="var(--border-default)" strokeWidth="1"/>
                <line x1="100" y1="60" x2="160" y2="30" stroke="var(--border-default)" strokeWidth="1"/>
                <line x1="100" y1="60" x2="160" y2="90" stroke="var(--border-default)" strokeWidth="1"/>
                <line x1="160" y1="30" x2="180" y2="15" stroke="var(--border-default)" strokeWidth="1"/>
                <rect x="84" y="50" width="32" height="20" rx="4" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1"/>
                <rect x="22" y="22" width="36" height="16" rx="3" fill="var(--bg-surface)" stroke="var(--border-default)" strokeWidth="1"/>
                <rect x="22" y="82" width="36" height="16" rx="3" fill="var(--bg-surface)" stroke="var(--border-default)" strokeWidth="1"/>
                <rect x="142" y="22" width="36" height="16" rx="3" fill="var(--bg-surface)" stroke="var(--border-default)" strokeWidth="1"/>
                <rect x="142" y="82" width="36" height="16" rx="3" fill="var(--bg-surface)" stroke="var(--border-default)" strokeWidth="1"/>
              </svg>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={libStyles.tag}>{m.tag}</span>
                <span className="meta">{m.nodes} nœuds</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const mmStyles = {
  root: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer' },
  thumb: { background: 'var(--bg-sunken)', height: 140, borderBottom: '1px solid var(--border-subtle)' },
};

// ---------------------------------------------------------------- Search graph
function SearchGraph() {
  return (
    <div style={sgStyles.root}>
      <div style={sgStyles.searchBar}>
        <Icon name="search" size={16} style={{ color: 'var(--fg-muted)' }} />
        <input defaultValue="syndrome coronarien aigu" style={{ flex: 1, border: 0, outline: 0, fontSize: 14, background: 'transparent', color: 'var(--fg-1)' }} />
        <span className="meta">23 résultats · 8 connexions</span>
      </div>
      <div style={sgStyles.body}>
        <div style={sgStyles.results}>
          <div className="eyebrow">Résultats</div>
          {[
            { ico: 'file-text', name: 'Cardio — ECN polycopié 2024.pdf', sub: '12 occurrences · p. 42, 67, 89...' },
            { ico: 'layers', name: 'Anki — SCA · 18 cartes', sub: 'Deck pharmaco' },
            { ico: 'alert-triangle', name: 'Erreur — ECG sus-décalage', sub: 'Carnet · il y a 3 j' },
            { ico: 'git-branch', name: 'Mindmap — Conduction cardiaque', sub: '4 nœuds liés' },
            { ico: 'highlighter', name: 'Annotation — H3 troponine', sub: 'p. 44 · jaune' },
          ].map((r, i) => (
            <div key={i} style={sgStyles.resRow}>
              <Icon name={r.ico} size={14} style={{ color: 'var(--fg-muted)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                <div className="meta">{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={sgStyles.graph}>
          <svg width="100%" height="100%" viewBox="0 0 600 400">
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--border-subtle)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
            {/* Edges */}
            <g stroke="var(--border-default)" strokeWidth="1.5" fill="none">
              <path d="M 300 200 Q 250 130 200 100" />
              <path d="M 300 200 Q 380 130 440 100" />
              <path d="M 300 200 Q 220 270 160 310" />
              <path d="M 300 200 Q 380 280 460 310" />
              <path d="M 300 200 L 200 200" />
              <path d="M 300 200 L 400 200" />
              <path d="M 200 100 L 100 60" />
              <path d="M 440 100 L 530 70" />
            </g>
            {/* Center node */}
            <g>
              <circle cx="300" cy="200" r="32" fill="var(--accent)" />
              <text x="300" y="195" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter Tight">SCA</text>
              <text x="300" y="208" textAnchor="middle" fill="#fff" fontSize="9" opacity="0.85">item 334</text>
            </g>
            {/* Other nodes */}
            {[
              { x: 200, y: 100, label: 'ECG ST+', kind: 'pdf' },
              { x: 440, y: 100, label: 'Troponine', kind: 'card' },
              { x: 160, y: 310, label: 'Anki · 18', kind: 'anki' },
              { x: 460, y: 310, label: 'Erreur ECG', kind: 'error' },
              { x: 200, y: 200, label: 'Aspirine', kind: 'card' },
              { x: 400, y: 200, label: 'Reperfusion', kind: 'card' },
              { x: 100, y: 60, label: 'Polycopié', kind: 'pdf' },
              { x: 530, y: 70, label: 'Mindmap', kind: 'map' },
            ].map((n, i) => {
              const colors = { pdf: ['#fff', 'var(--border-default)', 'var(--fg-1)'], card: ['var(--accent-bg)', 'var(--accent-border)', 'var(--accent-fg)'], anki: ['var(--success-bg)', 'var(--success-border)', 'var(--success-fg)'], error: ['var(--danger-bg)', 'var(--danger-border)', 'var(--danger-fg)'], map: ['var(--info-bg)', 'var(--info-border)', 'var(--info-fg)'] };
              const [bg, br, fg] = colors[n.kind];
              return (
                <g key={i}>
                  <rect x={n.x - 38} y={n.y - 12} width="76" height="24" rx="6" fill={bg} stroke={br} strokeWidth="1" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fill={fg} fontSize="10" fontWeight="500" fontFamily="Inter Tight">{n.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
const sgStyles = {
  root: { padding: 24, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' },
  body: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, flex: 1, overflow: 'hidden' },
  results: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' },
  resRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  graph: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
};

Object.assign(window, { CommandPalette, Mindmaps, SearchGraph });
