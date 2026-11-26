/* Onigiri on iPhone/iPad (Kioku): touch and phone-layout support shared by
 * every Onigiri page. Loaded in <head>, before Onigiri's other scripts.
 *
 * - <html> classes: onigiri-touch (coarse pointer, no hover),
 *   onigiri-phone (<= 600px wide), onigiri-tablet (touch, wider), kept up to
 *   date on rotation / split view.
 * - Long-press -> contextmenu. iOS WKWebView never fires `contextmenu`, and
 *   Onigiri opens every deck/tag/favorite action menu from it. A 500 ms press
 *   that does not move dispatches a synthetic contextmenu at the touch point
 *   on elements registered with OnigiriMobile.longPress(selector), and
 *   swallows the click that follows the finger lifting.
 * - Deck list on touch: a visible "more" button per deck row, and a
 *   Select mode that turns taps into multi-selection (desktop uses
 *   Ctrl/Shift+click).
 * - Phone home screen: a bottom tab bar switching between the deck sidebar
 *   and the widget dashboard, which no longer fit side by side.
 */
(function () {
    'use strict';
    if (window.OnigiriMobile) return;

    var root = document.documentElement;
    var PHONE_MAX = 600;
    var LONG_PRESS_MS = 500;
    var MOVE_TOLERANCE = 10;

    function mq(query) {
        try { return window.matchMedia(query).matches; } catch (e) { return false; }
    }

    function isTouch() {
        return mq('(pointer: coarse)') || mq('(hover: none)') ||
            root.classList.contains('onigiri-mobile');
    }

    function isPhone() {
        return Math.min(window.innerWidth || 9999, (window.screen && screen.width) || 9999) <= PHONE_MAX ||
            (window.innerWidth || 9999) <= PHONE_MAX;
    }

    function updateClasses() {
        var touch = isTouch();
        var phone = isPhone();
        root.classList.toggle('onigiri-touch', touch);
        root.classList.toggle('onigiri-phone', phone);
        root.classList.toggle('onigiri-tablet', touch && !phone);
    }

    updateClasses();
    window.addEventListener('resize', updateClasses, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(updateClasses, 50); });

    // --- Long-press -> contextmenu ------------------------------------------------

    var longPressSelectors = [
        '#deck-list-container tr.deck',
        '[oncontextmenu]',
        '[data-onigiri-longpress]',
    ];
    var press = null;
    var suppressClickUntil = 0;

    function longPressTarget(el) {
        if (!el || !el.closest) return null;
        for (var i = 0; i < longPressSelectors.length; i++) {
            var hit = el.closest(longPressSelectors[i]);
            if (hit) return hit;
        }
        return null;
    }

    function cancelPress() {
        if (press) {
            clearTimeout(press.timer);
            if (press.el) press.el.classList.remove('onigiri-pressing');
        }
        press = null;
    }

    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse') return;
        if (event.target.closest && event.target.closest('.drag-handle, input, textarea, select, [contenteditable="true"]')) return;
        var el = longPressTarget(event.target);
        if (!el) return;
        cancelPress();
        var origin = event.target;
        press = {
            el: el,
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(function () {
                if (!press) return;
                var p = press;
                press = null;
                p.el.classList.remove('onigiri-pressing');
                suppressClickUntil = Date.now() + 800;
                try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
                var evt = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: p.x,
                    clientY: p.y,
                    screenX: p.x,
                    screenY: p.y,
                    button: 2,
                    buttons: 2,
                });
                evt.onigiriLongPress = true;
                origin.dispatchEvent(evt);
            }, LONG_PRESS_MS),
        };
        el.classList.add('onigiri-pressing');
    }, true);

    document.addEventListener('pointermove', function (event) {
        if (!press) return;
        if (Math.abs(event.clientX - press.x) > MOVE_TOLERANCE ||
            Math.abs(event.clientY - press.y) > MOVE_TOLERANCE) {
            cancelPress();
        }
    }, true);
    ['pointerup', 'pointercancel', 'scroll'].forEach(function (type) {
        document.addEventListener(type, cancelPress, true);
    });

    // The finger lifting after a long-press produces a click on the row,
    // which would open the deck and close the menu that just opened.
    document.addEventListener('click', function (event) {
        if (Date.now() < suppressClickUntil) {
            suppressClickUntil = 0;
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    // A native contextmenu (iPad trackpad/mouse right click) means no
    // synthetic one is needed for this press.
    document.addEventListener('contextmenu', function (event) {
        if (!event.onigiriLongPress) cancelPress();
    }, true);

    // --- Deck list: "more" buttons and Select mode -------------------------------

    var MORE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
        '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' +
        '<circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';

    function t(key, fallback) {
        try {
            if (typeof window.ONIGIRI_T === 'function') return window.ONIGIRI_T(key, fallback);
        } catch (e) {}
        return fallback;
    }

    function openRowMenu(row, anchor) {
        var rect = anchor.getBoundingClientRect();
        var evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left,
            clientY: rect.bottom,
            button: 2,
        });
        evt.onigiriLongPress = true;
        row.dispatchEvent(evt);
    }

    function decorateDeckRows() {
        if (!root.classList.contains('onigiri-touch')) return;
        var rows = document.querySelectorAll('#deck-list-container tr.deck[data-did]');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.querySelector(':scope > .onigiri-row-more-cell')) continue;
            var cell = document.createElement('td');
            cell.className = 'onigiri-row-more-cell';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'onigiri-row-more';
            btn.setAttribute('aria-label', t('more', 'More'));
            btn.innerHTML = MORE_SVG;
            cell.appendChild(btn);
            row.appendChild(cell);
        }
    }

    document.addEventListener('click', function (event) {
        var btn = event.target.closest && event.target.closest('.onigiri-row-more');
        if (!btn) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var row = btn.closest('tr.deck');
        if (row) openRowMenu(row, btn);
    }, true);

    var selectMode = false;

    function setSelectMode(on) {
        selectMode = !!on;
        root.classList.toggle('onigiri-select-mode', selectMode);
        var btn = document.getElementById('onigiri-select-toggle');
        if (btn) btn.setAttribute('aria-pressed', selectMode ? 'true' : 'false');
        if (!selectMode && window.OnigiriEngine && OnigiriEngine.clearMultiSelection) {
            try { OnigiriEngine.clearMultiSelection(); } catch (e) {}
        }
    }

    function addSelectToggle() {
        if (!root.classList.contains('onigiri-touch')) return;
        var actions = document.querySelector('#deck-list-header .deck-header-actions');
        if (!actions || document.getElementById('onigiri-select-toggle')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'onigiri-select-toggle';
        btn.className = 'deck-header-btn onigiri-select-toggle';
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = t('select', 'Select');
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            setSelectMode(!selectMode);
        });
        actions.insertBefore(btn, actions.firstChild);
    }

    // In Select mode a tap selects instead of opening the deck. Runs in the
    // capture phase so it wins over the deck link's own onclick.
    document.addEventListener('click', function (event) {
        if (!selectMode) return;
        var container = document.getElementById('deck-list-container');
        if (!container || !container.contains(event.target)) return;
        if (event.target.closest('a.collapse, .onigiri-row-more, .drag-handle')) return;
        var row = event.target.closest('tr.deck[data-did]');
        if (!row || !window.OnigiriEngine || !OnigiriEngine.toggleMultiSelection) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        OnigiriEngine.toggleMultiSelection(row, event);
    }, true);

    // --- Phone tab bar (deck browser) --------------------------------------------

    var TAB_KEY = 'onigiriPhoneTab';

    function readTab() {
        try { return sessionStorage.getItem(TAB_KEY) || 'decks'; } catch (e) { return 'decks'; }
    }

    function applyTab(tab) {
        root.classList.toggle('onigiri-phone-tab-decks', tab !== 'home');
        root.classList.toggle('onigiri-phone-tab-home', tab === 'home');
        var bar = document.getElementById('onigiri-phone-tabs');
        if (bar) {
            bar.querySelectorAll('button[data-tab]').forEach(function (b) {
                b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
            });
        }
        try { sessionStorage.setItem(TAB_KEY, tab); } catch (e) {}
        // Widgets measure themselves (heatmap, grids): let them reflow now
        // that they are visible.
        setTimeout(function () {
            try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        }, 0);
    }

    var DECKS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M7 4h10"/></svg>';
    var HOME_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/></svg>';

    function addPhoneTabs() {
        var container = document.querySelector('.container.modern-main-menu');
        if (!container || document.getElementById('onigiri-phone-tabs')) return;
        var bar = document.createElement('nav');
        bar.id = 'onigiri-phone-tabs';
        bar.setAttribute('role', 'tablist');
        [
            ['decks', DECKS_SVG, t('decks', 'Decks')],
            ['home', HOME_SVG, t('home', 'Home')],
        ].forEach(function (spec) {
            var b = document.createElement('button');
            b.type = 'button';
            b.dataset.tab = spec[0];
            b.setAttribute('role', 'tab');
            b.innerHTML = spec[1] + '<span>' + spec[2] + '</span>';
            b.addEventListener('click', function () { applyTab(spec[0]); });
            bar.appendChild(b);
        });
        document.body.appendChild(bar);
        root.classList.add('onigiri-has-phone-tabs');
        applyTab(readTab());
    }

    function onReady() {
        updateClasses();
        addPhoneTabs();
        addSelectToggle();
        decorateDeckRows();
        var container = document.getElementById('deck-list-container');
        if (container && typeof MutationObserver !== 'undefined') {
            new MutationObserver(function () {
                decorateDeckRows();
            }).observe(container, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    window.OnigiriMobile = {
        isTouch: function () { return root.classList.contains('onigiri-touch'); },
        isPhone: function () { return root.classList.contains('onigiri-phone'); },
        longPress: function (selector) {
            if (selector && longPressSelectors.indexOf(selector) < 0) longPressSelectors.push(selector);
        },
        setSelectMode: setSelectMode,
        showTab: applyTab,
        refresh: function () { updateClasses(); decorateDeckRows(); addSelectToggle(); },
    };
})();
