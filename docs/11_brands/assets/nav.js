const isEmbedded = (() => {
  try { if (window.self !== window.top) return true; } catch (e) { return true; }
  return new URLSearchParams(window.location.search).get('embed') === '1';
})();

const navLinks = document.querySelectorAll('.nav a[href^="#"]');
const navLogo = document.getElementById('nav-logo');

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
