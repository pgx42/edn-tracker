// EDN Tracker — App UI kit components
// Single-file because Babel script scopes don't merge.
// Style objects use unique names to prevent collisions.

const { useState, useEffect, useRef } = React;

// ---------------------------------------------------------------- Icon
// Tiny Lucide wrapper — renders SVGs from window.lucide if loaded
function Icon({ name, size = 16, stroke = 1.5, className, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.setAttribute('data-lucide', name);
      ref.current.removeAttribute('data-rendered');
      window.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': stroke }, nameAttr: 'data-lucide' });
    }
  }, [name, size, stroke]);
  return <i ref={ref} data-lucide={name} className={className} style={{ display: 'inline-flex', width: size, height: size, ...style }} />;
}

// ---------------------------------------------------------------- Sidebar
function Sidebar({ active, onNavigate, theme, onToggleTheme }) {
  const sections = [
    { group: 'Travail', items: [
      { id: 'today', icon: 'sun', label: "Aujourd'hui", count: 42, hot: true },
      { id: 'anki', icon: 'layers', label: 'Anki', count: 128 },
      { id: 'errors', icon: 'alert-triangle', label: "Carnet d'erreurs", count: 7 },
    ]},
    { group: 'Connaissance', items: [
      { id: 'library', icon: 'book-open', label: 'Bibliothèque' },
      { id: 'mindmaps', icon: 'git-branch', label: 'Mindmaps' },
      { id: 'calendar', icon: 'calendar', label: 'Calendrier' },
      { id: 'search', icon: 'search', label: 'Recherche', shortcut: '⌘K' },
    ]},
  ];
  return (
    <aside style={sidebarStyles.root}>
      <div style={sidebarStyles.brand}>
        <img src="../../assets/logo.svg" width="22" height="22" alt="" />
        <span style={sidebarStyles.brandText}>EDN Tracker</span>
      </div>
      <nav style={sidebarStyles.nav}>
        {sections.map(s => (
          <div key={s.group} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={sidebarStyles.groupLabel}>{s.group}</div>
            {s.items.map(it => {
              const isActive = active === it.id;
              return (
                <button key={it.id} onClick={() => onNavigate(it.id)}
                  style={{ ...sidebarStyles.item, ...(isActive ? sidebarStyles.itemActive : {}) }}>
                  <Icon name={it.icon} size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                  {it.count != null && (
                    <span style={{ ...sidebarStyles.count, ...(it.hot ? sidebarStyles.countHot : {}) }}>{it.count}</span>
                  )}
                  {it.shortcut && <span style={sidebarStyles.kbd}>{it.shortcut}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={sidebarStyles.footer}>
        <button style={sidebarStyles.themeBtn} onClick={onToggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          <span>{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
        </button>
        <div style={sidebarStyles.user}>
          <div style={sidebarStyles.avatar}>AL</div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={sidebarStyles.userName}>Anaïs L.</div>
            <div style={sidebarStyles.userMeta}>DFASM2 · Paris</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

const sidebarStyles = {
  root: { width: 240, height: '100%', background: 'var(--bg-canvas)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' },
  brandText: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' },
  nav: { padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto' },
  groupLabel: { fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 4px' },
  item: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', height: 30, fontSize: 13, color: 'var(--fg-2)', background: 'transparent', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left' },
  itemActive: { background: 'var(--bg-selected)', color: 'var(--accent-fg)', fontWeight: 500 },
  count: { fontSize: 11, color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums', background: 'var(--bg-sunken)', padding: '1px 6px', borderRadius: 999 },
  countHot: { color: 'var(--danger-fg)', background: 'var(--danger-bg)' },
  kbd: { fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' },
  footer: { padding: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 },
  themeBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 12, justifyContent: 'center' },
  user: { display: 'flex', alignItems: 'center', gap: 10, padding: 6 },
  avatar: { width: 28, height: 28, borderRadius: 999, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 },
  userName: { fontSize: 12, fontWeight: 500 },
  userMeta: { fontSize: 11, color: 'var(--fg-3)' },
};

// ---------------------------------------------------------------- TopBar
function TopBar({ title, breadcrumb, onOpenPalette }) {
  return (
    <header style={topbarStyles.root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {breadcrumb && (
          <div style={topbarStyles.crumb}>
            {breadcrumb.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Icon name="chevron-right" size={12} style={{ color: 'var(--fg-muted)' }} />}
                <span style={i === breadcrumb.length - 1 ? topbarStyles.crumbActive : topbarStyles.crumbItem}>{c}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {title && <h1 style={topbarStyles.title}>{title}</h1>}
      </div>
      <button onClick={onOpenPalette} style={topbarStyles.searchBtn}>
        <Icon name="search" size={14} />
        <span>Rechercher</span>
        <span style={topbarStyles.searchKbd}>⌘K</span>
      </button>
      <button style={topbarStyles.iconBtn}><Icon name="bell" size={16} /></button>
    </header>
  );
}

const topbarStyles = {
  root: { height: 48, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)', flexShrink: 0 },
  crumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-3)' },
  crumbItem: { color: 'var(--fg-3)' },
  crumbActive: { color: 'var(--fg-1)', fontWeight: 500 },
  title: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 },
  searchBtn: { display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', minWidth: 220 },
  searchKbd: { marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)' },
  iconBtn: { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--fg-2)' },
};

Object.assign(window, { Icon, Sidebar, TopBar });
