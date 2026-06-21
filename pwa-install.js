// =================================================================
// FILE: pwa-install.js
// Description: Shows a floating "Install App" button when the
// browser fires `beforeinstallprompt` (Chrome/Edge/Android), and a
// one-time manual instructions banner for iOS Safari (which has no
// beforeinstallprompt event at all — install is Share → Add to Home
// Screen, so we can only nudge the user, not trigger it ourselves).
//
// Include this on every page with: <script src="./pwa-install.js"></script>
// Safe to include multiple times across pages — it's self-contained.
// =================================================================

(function () {
    let deferredPrompt = null;

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true; // iOS
    }

    function isIos() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    function createButton() {
        if (document.getElementById('pwa-install-btn')) return document.getElementById('pwa-install-btn');

        const btn = document.createElement('button');
        btn.id = 'pwa-install-btn';
        btn.type = 'button';
        btn.innerHTML = '⬇️ &nbsp;Install App';
        btn.style.cssText = `
            position: fixed;
            bottom: 18px;
            right: 18px;
            z-index: 10000;
            background: #1d4ed8;
            color: #fff;
            border: none;
            border-radius: 9999px;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: 700;
            font-family: inherit;
            box-shadow: 0 4px 14px rgba(0,0,0,0.25);
            cursor: pointer;
            display: none;
            align-items: center;
            transition: transform 0.15s, box-shadow 0.15s;
        `;
        btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)'; };
        btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)'; };
        document.body.appendChild(btn);
        return btn;
    }

    function showButton() {
        const btn = createButton();
        btn.style.display = 'flex';
    }

    function hideButton() {
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'none';
    }

    // Already installed / running standalone → never show the button
    if (isStandalone()) {
        window.addEventListener('DOMContentLoaded', hideButton);
        return;
    }

    // Chrome / Edge / Android: browser tells us when install is available
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); // stop the mini-infobar
        deferredPrompt = e;
        showButton();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideButton();
        sessionStorage.setItem('pwaInstalled', 'true');
    });

    document.addEventListener('DOMContentLoaded', () => {
        const btn = createButton();

        btn.addEventListener('click', async () => {
            if (deferredPrompt) {
                btn.disabled = true;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('[PWA] Install prompt outcome:', outcome);
                deferredPrompt = null;
                btn.disabled = false;
                hideButton();
                return;
            }

            // iOS Safari has no install API — show manual instructions instead
            if (isIos()) {
                alert('To install Garage Manager PRO:\n\n1. Tap the Share icon (square with an arrow) in Safari\'s toolbar\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"');
            }
        });

        // iOS: there's no event to tell us installability, so show the
        // button after a short delay as a permanent gentle nudge,
        // unless the user already installed (best-effort via sessionStorage).
        if (isIos() && sessionStorage.getItem('pwaInstalled') !== 'true') {
            showButton();
        }
    });
})();
