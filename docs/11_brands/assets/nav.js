const isEmbedded = (() => {
  try { if (window.self !== window.top) return true; } catch (e) { return true; }
  return new URLSearchParams(window.location.search).get('embed') === '1';
})();

const navLinks = document.querySelectorAll('.nav a[href^="#"]');
const navLogo = document.getElementById('nav-logo');

// ── DOC LIST (shared source of truth for the nav menu panel) ──
const DOCS = [
  {
    category: 'Operacional',
    items: [
      { title: 'Automações Ativas', file: 'operacional/automations.html' },
      { title: 'Trilha de Formação — Agentes de IA', file: 'operacional/recommended_courses.html' },
    ],
  },
  {
    category: 'Dados & Analytics',
    items: [
      { title: 'Sprint Handbook', file: 'dados-analytics/data_sprint_handbook.html' },
      { title: 'Padrão de Layout — Power BI', file: 'dados-analytics/layout_standard_for_power_bi.html' },
      { title: 'Paleta de Cores', file: 'dados-analytics/color_palette.html' },
      { title: 'Deduplicação Amazon SP-API', file: 'dados-analytics/amazon_multimarketplace_dedup.html' },
      { title: 'OrganiHaus Base Tables — PRD', file: 'dados-analytics/organihaus_base_tables_prd.html' },
    ],
  },
  {
    category: 'Liderança',
    items: [
      { title: 'Reunião Level 10', file: 'lideranca/l10_meetings.html' },
      { title: 'Como Elaborar Rocks', file: 'lideranca/rocks_sop.html' },
    ],
  },
];

// ── NAV MENU PANEL (doc-to-doc navigation) ──
const navActions = document.querySelector('.nav-actions');
const menuToggle = document.getElementById('nav-menu-toggle');
const menuPanel = document.getElementById('nav-menu-panel');

if (isEmbedded) {
  if (navActions) navActions.style.display = 'none';
} else if (menuToggle && menuPanel) {
  const currentPath = window.location.pathname.split('/').slice(-2).join('/');

  menuPanel.innerHTML = DOCS.map(group => `
    <div>
      <div class="nav-menu-group-label">${group.category}</div>
      <div class="nav-menu-links">
        ${group.items.map(item => `<a href="../${item.file}"${currentPath.endsWith(item.file) ? ' class="current"' : ''}>${item.title}</a>`).join('')}
      </div>
    </div>
  `).join('');

  const closeMenu = () => {
    menuPanel.classList.remove('open');
    menuToggle.classList.remove('active');
  };

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle('open');
    menuToggle.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!menuPanel.contains(e.target) && e.target !== menuToggle) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

if (isEmbedded) {
  if (navLogo) navLogo.style.visibility = 'visible';
} else {
  const sections = Array.from(navLinks)
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const cover = document.querySelector('.cover');

  function updateNavLogo() {
    if (!navLogo) return;
    const coverBottom = cover ? cover.getBoundingClientRect().bottom : 0;
    navLogo.style.visibility = coverBottom <= 52 ? 'visible' : 'hidden';
  }

  function setActive(forceId) {
    let current = sections[0];
    const scrollY = window.scrollY + 100;

    if (forceId) {
      current = document.getElementById(forceId) || current;
    } else {
      sections.forEach(section => {
        if (section.offsetTop <= scrollY) current = section;
      });
    }

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current.id) {
        link.classList.add('active');
      }
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('href').replace('#', '');
      setActive(id);
      setTimeout(() => setActive(id), 600);
    });
  });

  window.addEventListener('scroll', () => { setActive(); updateNavLogo(); }, { passive: true });
  setActive();
  updateNavLogo();
}
