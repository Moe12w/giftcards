'use client';

// Instant feedback for every dashboard navigation and every server action.
//
// The App Router keeps the old screen on display until the next route is ready.
// That is technically correct, but it reads as "the click did nothing" when a
// server action takes a second. This component listens to the two things a user
// can trigger — a link click and a form submit — and paints a progress bar,
// switches the cursor and marks the pressed button as busy until the URL
// actually changes.
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

const SAFETY_MS = 15_000;

function isInternalNavigation(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // Clicking the page you are already on is not a navigation.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }
  return true;
}

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clearTimer = useRef<number | null>(null);
  const busyButton = useRef<HTMLButtonElement | null>(null);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const clear = () => {
      if (clearTimer.current !== null) {
        window.clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
      document.body.classList.remove('nav-pending');
      document.body.removeAttribute('aria-busy');

      const button = busyButton.current;
      if (button) {
        button.removeAttribute('data-pending');
        button.removeAttribute('aria-busy');
        button.disabled = false;
        busyButton.current = null;
      }
    };
    finishRef.current = clear;

    const start = (button?: HTMLButtonElement | null) => {
      document.body.classList.add('nav-pending');
      document.body.setAttribute('aria-busy', 'true');

      if (button) {
        button.dataset.pending = 'true';
        button.setAttribute('aria-busy', 'true');
        busyButton.current = button;
        // Wait a tick: the browser builds the form entry list from the submit
        // button, and disabling it too early would drop its name/value.
        window.setTimeout(() => {
          if (busyButton.current === button && button.isConnected) {
            button.disabled = true;
          }
        }, 0);
      }

      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(clear, SAFETY_MS);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigation(anchor)) return;
      start();
    };

    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      // Client-only forms opt out by setting data-pending="off".
      if (form.dataset.pending === 'off') return;
      const submitter =
        event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      start(submitter);
    };

    const onHistory = () => start();

    // Some server actions only revalidate the current route and never redirect.
    // Watching the action's POST lets the feedback finish when the work does,
    // instead of leaving a progress bar running.
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const settle = () => {
        if (method === 'POST' && document.body.classList.contains('nav-pending')) {
          window.setTimeout(() => finishRef.current(), 150);
        }
      };
      return originalFetch.call(window, input, init).then(
        (response) => {
          settle();
          return response;
        },
        (error: unknown) => {
          settle();
          throw error;
        },
      );
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('popstate', onHistory);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('popstate', onHistory);
      clear();
    };
  }, []);

  // The URL is the source of truth: once it changes the new screen is being
  // rendered, so the feedback has done its job.
  useEffect(() => {
    document.body.classList.remove('nav-pending');
    document.body.removeAttribute('aria-busy');
    const button = busyButton.current;
    if (button) {
      button.removeAttribute('data-pending');
      button.removeAttribute('aria-busy');
      button.disabled = false;
      busyButton.current = null;
    }
  }, [pathname, searchParams]);

  return <div className="nav-progress" aria-hidden="true" />;
}
