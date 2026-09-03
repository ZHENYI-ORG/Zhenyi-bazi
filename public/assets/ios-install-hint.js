(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
  var isStandalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var dismissedKey = 'zhenyi-ios-install-hint-dismissed-v1';

  if (!isIOS || !isSafari || isStandalone) return;
  try { if (localStorage.getItem(dismissedKey) === '1') return; } catch (_) {}

  function mount() {
    if (document.querySelector('.ios-install-hint')) return;
    var style = document.createElement('style');
    style.textContent = '\
      .ios-install-hint{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));z-index:1000;display:flex;align-items:center;gap:12px;width:min(420px,calc(100% - 28px));padding:13px 14px;border:1px solid rgba(182,154,97,.32);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 12px 32px rgba(28,24,18,.18),0 2px 8px rgba(28,24,18,.08);transform:translateX(-50%);font-family:"Noto Serif SC",Songti SC,SimSun,serif;animation:ios-install-hint-in .28s ease-out both}.ios-install-hint-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:11px;background:#f6f1e7;color:#9b7735}.ios-install-hint-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.ios-install-hint-copy{display:grid;gap:2px;min-width:0;flex:1}.ios-install-hint-copy strong{color:#4c3a20;font-size:12.6px;line-height:18px;font-weight:700}.ios-install-hint-copy small{color:#8c857a;font-size:10px;line-height:15px}.ios-install-hint button{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:#8e8a84;font:inherit;font-size:22px;line-height:1;cursor:pointer}.ios-install-hint button:active{background:#f2eee7}@keyframes ios-install-hint-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}@media(min-width:900px){.ios-install-hint{bottom:24px}}';
    document.head.appendChild(style);

    var hint = document.createElement('aside');
    hint.className = 'ios-install-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-label', '添加到主屏幕提示');
    hint.innerHTML = '<span class="ios-install-hint-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v11"></path><path d="m8 7 4-4 4 4"></path><path d="M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"></path></svg></span><span class="ios-install-hint-copy"><strong>添加到主屏幕</strong><small>在 Safari 点“分享”，再选“添加到主屏幕”</small></span><button type="button" aria-label="关闭添加到主屏幕提示">×</button>';
    hint.querySelector('button').addEventListener('click', function () {
      try { localStorage.setItem(dismissedKey, '1'); } catch (_) {}
      hint.remove();
      style.remove();
    });
    document.body.appendChild(hint);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
