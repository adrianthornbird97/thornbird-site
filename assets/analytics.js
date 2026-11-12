/* GA4 events + Consent Mode v2 banner for thornbird97.com and /finertecture/. */
(function () {
  var KEY = 'tb_cookie_consent';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function gtagFn() {
    return typeof window.gtag === 'function' ? window.gtag : function () {};
  }
  function updateConsent(granted) {
    gtagFn()('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }
  function track(name, params) {
    params = params || {};
    gtagFn()('event', name, params);
  }
  function sameSite(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin === location.origin) return true;
      var h = u.hostname.replace(/^www\./, '');
      return h === 'thornbird97.com' || h === 'finertecture.com';
    } catch (e) { return true; }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.closest('.sh-pop')) return;
    var href = a.href || '';
    if (/^mailto:/i.test(href)) {
      track('contact_email_click', {
        link_url: href,
        transport_type: 'beacon'
      });
      return;
    }
    if (/^(tel:|javascript:|#)/i.test(href)) return;
    if (!sameSite(href)) {
      track('outbound_click', {
        link_url: href,
        link_text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        transport_type: 'beacon'
      });
    }
  }, true);

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.tb-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:90;display:flex;align-items:center;justify-content:space-between;gap:12px 16px;flex-wrap:wrap;box-sizing:border-box;max-width:880px;margin:0 auto;padding:14px 18px;background:var(--card,var(--paper,#fff));color:var(--ink,var(--c,#1c2630));font-family:Inter,"IBM Plex Serif",system-ui,sans-serif;font-size:.95rem;line-height:1.45;border-radius:12px;box-shadow:0 12px 30px rgba(15,42,63,.16);border:1px solid var(--line,#e4e0d6)}' +
      '.tb-consent p{margin:0;flex:1 1 200px}' +
      '.tb-consent-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}' +
      '.tb-consent button{font-family:inherit;font-size:.92rem;font-weight:600;line-height:1;border-radius:999px;padding:.7rem 1.15rem;min-height:44px;cursor:pointer}' +
      '.tb-consent-accept{border:1.5px solid transparent}' +
      '.tb-consent-thornbird .tb-consent-accept{background:#d4a24c;color:#0f2a3f}' +
      '.tb-consent-thornbird .tb-consent-accept:hover{background:#e3b764}' +
      '.tb-consent-finertecture .tb-consent-accept{background:#23538E;color:#fff}' +
      '.tb-consent-finertecture .tb-consent-accept:hover{background:#2E66A8}' +
      '.tb-consent-decline{background:transparent;color:var(--navy,var(--blue,#0f2a3f));border:1.5px solid rgba(15,42,63,.28)}' +
      '.tb-consent-decline:hover{background:var(--bg,var(--tint,#f7f5f0))}' +
      '.tb-consent button:focus-visible{outline:3px solid var(--accent,var(--blue,#d4a24c));outline-offset:3px}' +
      '@media (max-width:600px){.tb-consent{left:10px;right:10px;bottom:12px;padding:12px 14px;font-size:.9rem}}';
    document.head.appendChild(s);
  }

  function showBanner() {
    if (stored() === 'granted' || stored() === 'denied') return;
    css();
    var bar = document.createElement('div');
    var theme = location.pathname.indexOf('/finertecture') === 0 ? 'finertecture' : 'thornbird';
    bar.className = 'tb-consent tb-consent-' + theme;
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.setAttribute('aria-describedby', 'tb-consent-msg');
    bar.innerHTML =
      '<p id="tb-consent-msg">We use analytics cookies to improve the site.</p>' +
      '<div class="tb-consent-actions">' +
      '<button type="button" class="tb-consent-accept">Accept</button>' +
      '<button type="button" class="tb-consent-decline">Decline</button>' +
      '</div>';
    function finish(granted) {
      store(granted ? 'granted' : 'denied');
      updateConsent(granted);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
    bar.querySelector('.tb-consent-accept').addEventListener('click', function () { finish(true); });
    bar.querySelector('.tb-consent-decline').addEventListener('click', function () { finish(false); });
    (document.body || document.documentElement).appendChild(bar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
