// Bewegung & Licht: Lichtreflex/Tilt auf Karten, Einblenden beim Scrollen,
// Header-Pille wird über dunklen Bühnen rauchig.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

function initTilt() {
  let active = null;
  addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.fx');
    if (active && active !== el) {
      active.style.transform = '';
      active = null;
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    if (finePointer.matches && !reduced.matches) {
      el.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-4px)`;
    }
    active = el;
  }, { passive: true });
}

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    }
  }, { rootMargin: '0px 0px -40px 0px' });
  const scan = () => document.querySelectorAll('.rv:not(.in)').forEach((el) => io.observe(el));
  new MutationObserver(scan).observe(document.getElementById('app'), { childList: true, subtree: true });
  scan();
}

function initHeader() {
  let ticking = false;
  const update = () => {
    ticking = false;
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const mid = bar.getBoundingClientRect().top + bar.offsetHeight / 2;
    const overDark = [...document.querySelectorAll('main .stage, .foot')].some((s) => {
      const r = s.getBoundingClientRect();
      return r.top < mid && r.bottom - 40 > mid;
    });
    bar.classList.toggle('on-dark', overDark);
  };
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.getElementById('app'), { childList: true, subtree: true });
  update();
}

export function initEffects() {
  initTilt();
  initReveal();
  initHeader();
}
