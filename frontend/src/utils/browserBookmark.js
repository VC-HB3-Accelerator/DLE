/**
 * Браузер не даёт веб-странице самой записать пункт в закладки
 * (Chrome / Safari / Firefox). Копируем URL и подсказываем горячую клавишу.
 */

export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false;
  const plat = navigator.userAgentData?.platform || navigator.platform || '';
  const ua = navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(`${plat} ${ua}`);
}

/** Надёжное копирование: Clipboard API + fallback execCommand. */
export async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value || typeof document === 'undefined') return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* insecure context / permission — fallback ниже */
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
}

export async function copyUrlForBookmark(url) {
  return copyTextToClipboard(url);
}

/** Web Share API надёжен в основном на мобилках; на десктопе чаще ломается. */
export function shouldUseNativeShare() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  } catch {
    /* ignore */
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

/**
 * Поделиться ссылкой: native share (мобилка) или копирование в буфер.
 * @returns {'shared'|'copied'|'aborted'|'failed'}
 */
export async function shareOrCopyUrl({ url, title } = {}) {
  const href = String(url || '').trim();
  if (!href) return 'failed';

  if (shouldUseNativeShare()) {
    try {
      const data = { url: href, title: title || (typeof document !== 'undefined' ? document.title : '') };
      if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
        /* fall through to copy */
      } else {
        await navigator.share(data);
        return 'shared';
      }
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
    }
  }

  const ok = await copyTextToClipboard(href);
  return ok ? 'copied' : 'failed';
}
