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
 * - App feel on Onigiri's own screens (<html class="onigiri-app">, set by
 *   __init__.inject_mobile_assets): no sticky :hover (hover rules are
 *   removed on screens without a mouse or trackpad), instant press
 *   feedback, the screen edges in the page's colour, no rubber band and
 *   haptics through Kioku (core/ios_native.py, "onigiri_native:*").
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

    // --- Deck list <-> deck overview slide ---------------------------------------
    // <html> arrives with onigiri-enter-forward/back (__init__): the page is
    // held just off to the side, and slides in once it is ready to be shown.
    // Starting at once (while WebKit was still loading the page) finished
    // the slide before anything was on screen.
    (function screenTransition() {
        var cls = root.classList.contains('onigiri-enter-forward') ? 'onigiri-enter-forward'
            : root.classList.contains('onigiri-enter-back') ? 'onigiri-enter-back' : '';
        if (!cls) return;
        var started = false;
        function start() {
            if (started) return;
            started = true;
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    root.classList.add('onigiri-entering');
                    setTimeout(function () {
                        root.classList.remove(cls, 'onigiri-entering');
                    }, 520);
                });
            });
        }
        window.addEventListener('load', start);
        document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 450); });
        setTimeout(start, 1200);
    })();
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
            clearTimeout(press.cue);
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
                haptic('medium');
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
        // the "about to open the menu" cue shows once the finger has stayed
        // put for a moment, not at the start of every scroll
        var cueRow = press;
        press.cue = setTimeout(function () { if (press === cueRow) el.classList.add('onigiri-pressing'); }, 160);
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


    // --- App feel: native bridge (core/ios_native.py) ----------------------------

    function nativeCmd(what) {
        if (!root.classList.contains('onigiri-ios')) return;
        try { if (typeof pycmd === 'function') pycmd('onigiri_native:' + what); } catch (e) {}
    }

    function haptic(kind) {
        if (root.classList.contains('onigiri-ios')) {
            nativeCmd('haptic:' + (kind || 'light'));
        } else {
            try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
        }
    }

    // --- App feel: no sticky hover -------------------------------------------------
    // On a touch screen a tap leaves :hover on the element until the next tap
    // somewhere else: tapped rows stayed highlighted, buttons stayed lit.
    // Without a mouse or trackpad, :hover rules are dropped from Onigiri's
    // stylesheets (`:not(:hover)` always holds then, so it is just removed).

    function hasMousePointer() {
        return mq('(any-hover: hover)') || mq('(any-pointer: fine)');
    }

    function splitSelectors(text) {
        var out = [];
        var depth = 0;
        var start = 0;
        for (var i = 0; i < text.length; i++) {
            var c = text.charAt(i);
            if (c === '(' || c === '[') depth++;
            else if (c === ')' || c === ']') depth--;
            else if (c === ',' && depth === 0) {
                out.push(text.slice(start, i));
                start = i + 1;
            }
        }
        out.push(text.slice(start));
        return out;
    }

    function stripHoverRules(list) {
        if (!list) return 0;
        var removed = 0;
        for (var i = list.length - 1; i >= 0; i--) {
            var rule = list[i];
            try {
                if (rule.cssRules && rule.type !== 1) {
                    // @media/@supports/@layer: leave explicit hover queries alone
                    var cond = rule.conditionText || (rule.media && rule.media.mediaText) || '';
                    if (!/hover\s*:\s*hover|pointer\s*:\s*fine/.test(cond)) removed += stripHoverRules(rule.cssRules);
                    continue;
                }
                if (rule.type === 3 && rule.styleSheet) { // @import
                    removed += stripHoverRules(rule.styleSheet.cssRules);
                    continue;
                }
                var sel = rule.selectorText;
                if (!sel || sel.indexOf(':hover') < 0) continue;
                var keep = splitSelectors(sel).map(function (part) {
                    return part.replace(/:not\(\s*:hover\s*\)/g, '');
                }).filter(function (part) {
                    return part.trim() && part.indexOf(':hover') < 0;
                });
                if (!keep.length) {
                    (rule.parentRule || rule.parentStyleSheet).deleteRule(i);
                } else {
                    rule.selectorText = keep.map(function (p) {
                        p = p.trim();
                        return /^[>+~]/.test(p) || p === '' ? '*' + p : p;
                    }).join(', ');
                }
                removed++;
            } catch (e) {}
        }
        return removed;
    }

    var strippedSheets = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

    function stripHover() {
        if (!root.classList.contains('onigiri-app') || !root.classList.contains('onigiri-touch')) return;
        if (hasMousePointer()) return;
        var sheets = document.styleSheets;
        for (var i = 0; i < sheets.length; i++) {
            var sheet = sheets[i];
            if (strippedSheets && strippedSheets.has(sheet)) continue;
            var rules;
            try { rules = sheet.cssRules; } catch (e) { continue; } // not loaded / cross-origin
            if (!rules) continue;
            stripHoverRules(rules);
            if (strippedSheets) strippedSheets.add(sheet);
        }
    }

    function watchStylesheets() {
        if (typeof MutationObserver === 'undefined') return;
        var pending = false;
        var obs = new MutationObserver(function (records) {
            for (var r = 0; r < records.length; r++) {
                var nodes = records[r].addedNodes;
                for (var n = 0; n < nodes.length; n++) {
                    var node = nodes[n];
                    if (node.nodeName === 'LINK') node.addEventListener('load', stripHover);
                    if ((node.nodeName === 'STYLE' || node.nodeName === 'LINK') && !pending) {
                        pending = true;
                        setTimeout(function () { pending = false; stripHover(); }, 0);
                    }
                }
            }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- App feel: press feedback --------------------------------------------------
    // iOS WebKit applies :active only when a touch listener exists, and a
    // web page lights a button only after the finger lifts. Native controls
    // dim the moment they are touched.

    var PRESSABLE = 'button, a[href], a[onclick], [role="button"], [role="tab"], [role="menuitem"], summary, ' +
        '.menu-item, tr.deck, .quick-menu-item, .osw-nav-item, .deck-header-btn, [onclick]';
    var pressed = null;
    var pressedAt = null;
    var pressTimer = null;
    var PRESS_DELAY = 80;

    function clearPressed(delay) {
        var el = pressed;
        clearTimeout(pressTimer);
        pressTimer = null;
        pressed = null;
        pressedAt = null;
        if (!el) return;
        if (delay) setTimeout(function () { el.classList.remove('onigiri-pressed'); }, delay);
        else el.classList.remove('onigiri-pressed');
    }

    document.addEventListener('touchstart', function () {}, { passive: true });

    // The pressed look appears after PRESS_DELAY, or when the finger lifts
    // (a quick tap still flashes): a swipe that starts on a row or tile no
    // longer flickers it at the start of every scroll.
    function showPressed(el) {
        if (pressed !== el) return;
        // a whole panel with an onclick is not a button
        var r = el.getBoundingClientRect();
        if (r.height > 160 && r.width > window.innerWidth * 0.6) { pressed = null; return; }
        el.classList.add('onigiri-pressed');
    }

    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse' || !root.classList.contains('onigiri-app')) return;
        var el = event.target.closest && event.target.closest(PRESSABLE);
        if (!el || el.closest('#qa') || el.disabled) return;
        clearPressed();
        pressed = el;
        pressedAt = { x: event.clientX, y: event.clientY };
        pressTimer = setTimeout(function () { pressTimer = null; showPressed(el); }, PRESS_DELAY);
    }, true);

    document.addEventListener('pointermove', function (event) {
        if (!pressedAt) return;
        if (Math.abs(event.clientX - pressedAt.x) > 8 || Math.abs(event.clientY - pressedAt.y) > 8) clearPressed();
    }, true);
    document.addEventListener('pointerup', function () {
        if (pressed && pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            showPressed(pressed);
        }
        clearPressed(90);
    }, true);
    document.addEventListener('pointercancel', function () { clearPressed(); }, true);
    document.addEventListener('scroll', function () { clearPressed(); }, true);

    // --- App feel: screen edges ------------------------------------------------------
    // Kioku pads <html> by the home indicator / notch and the main window's
    // margins fill the status bar strip: both showed Anki grey. <html> takes
    // the page's own colour and the main screens report it to the window.

    function opaqueBackground(el) {
        if (!el) return '';
        var bg = '';
        try { bg = getComputedStyle(el).backgroundColor; } catch (e) { return ''; }
        if (!bg || bg === 'transparent') return '';
        var m = bg.match(/rgba?\(([^)]+)\)/);
        if (m) {
            var parts = m[1].split(/[\s,\/]+/).filter(Boolean);
            if (parts.length > 3 && parseFloat(parts[3]) < 0.5) return '';
        }
        return bg;
    }

    var MAIN_SCREEN = '.container.modern-main-menu, .ba-home, .ba-side, body.onigiri-overview, .overview-bottom-actions, #qa';
    var lastEdge = '';

    // The colour actually showing at a point: the first opaque background
    // (or ::before layer, where themes put theirs) from the element there up.
    function colorAt(x, y) {
        var el = document.elementFromPoint(x, y);
        for (; el && el !== root; el = el.parentElement) {
            var c = opaqueBackground(el);
            if (!c) {
                try {
                    var b = getComputedStyle(el, '::before').backgroundColor;
                    if (b && !/rgba\([^)]*,\s*0(\.0*)?\)|transparent/.test(b)) c = b;
                } catch (e) {}
            }
            if (c) return c.replace(/\s+/g, '');
        }
        return (opaqueBackground(document.body) || opaqueBackground(root) || '').replace(/\s+/g, '');
    }

    // Theme surfaces for sheets, the Menu page and bars: the page's own
    // background, a raised shade and a fill shade (lighter on dark themes,
    // darker on light ones). Anki's grey showed through otherwise.
    function setSurfaces(color) {
        var rgb = rgbOf(color);
        if (!rgb) return;
        var dark = luminance(rgb) < 0.4;
        function mix(amount) {
            var target = dark ? 255 : 0;
            return 'rgb(' + rgb.map(function (v) { return Math.round(v + (target - v) * amount); }).join(', ') + ')';
        }
        var st = root.style;
        st.setProperty('--onigiri-surface', 'rgb(' + rgb.join(', ') + ')');
        st.setProperty('--onigiri-surface-raised', mix(dark ? 0.07 : 0.03));
        st.setProperty('--onigiri-surface-fill', mix(dark ? 0.13 : 0.07));
        st.setProperty('--onigiri-surface-line', mix(dark ? 0.2 : 0.12));
        st.setProperty('--onigiri-surface-ink', dark ? '#f2f2f7' : '#1c1c1e');
        root.classList.toggle('onigiri-surface-dark', dark);
    }

    function paintEdges() {
        if (!root.classList.contains('onigiri-app') || !document.body) return;
        root.style.backgroundColor = '';
        var color = opaqueBackground(document.body) ||
            opaqueBackground(document.querySelector('.container.modern-main-menu, .ba-home, #outer')) ||
            opaqueBackground(root);
        if (color) root.style.backgroundColor = color;
        if (color) setSurfaces(color);
        if (!document.querySelector(MAIN_SCREEN)) return;
        var h = window.innerHeight || root.clientHeight;
        var topColor = colorAt(2, 2);
        // the top fade blends the page into the status-bar strip, which
        // takes the same colour
        if (topColor) root.style.setProperty('--onigiri-edge-bg', topColor);
        if (!document.getElementById('onigiri-top-fade') && document.body) {
            var fade = document.createElement('div');
            fade.id = 'onigiri-top-fade';
            fade.setAttribute('aria-hidden', 'true');
            document.body.appendChild(fade);
        }
        var edge = topColor + '|' + colorAt(2, h - 2);
        if (edge !== '|' && edge !== lastEdge) {
            lastEdge = edge;
            nativeCmd('edge:' + edge);
        }
    }

    // --- Debug: what is wider than the screen? ----------------------------------------

    function findOverflow() {
        var w = document.documentElement.clientWidth;
        var out = [];
        document.querySelectorAll('body *').forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.width && (r.right > w + 1 || r.left < -1)) {
                var style = getComputedStyle(el);
                if (style.position === 'fixed' && style.visibility === 'hidden') return;
                out.push({
                    el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                        (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
                    left: Math.round(r.left),
                    right: Math.round(r.right),
                });
            }
        });
        return out;
    }

    // --- Deck list: "more" buttons and Select mode -------------------------------

    var TOOLS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

    // Row icons for the overview's deck sheet.
    var SVG_OPEN = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var RENAME_SVG = SVG_OPEN + '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    var OPTIONS_SVG = SVG_OPEN + '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
    var EXPORT_SVG = SVG_OPEN + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

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

    // Edit mode (like Reminders/Files): reorder handles and selection circles
    // appear, taps select, and a toolbar with Actions and Done replaces the
    // tab bar. Outside it there are no handles, so a drag always scrolls.
    function setSelectMode(on) {
        selectMode = !!on;
        root.classList.toggle('onigiri-select-mode', selectMode);
        var btn = document.getElementById('onigiri-select-toggle');
        if (btn) {
            btn.setAttribute('aria-pressed', selectMode ? 'true' : 'false');
            btn.textContent = selectMode ? t('done', 'Done') : t('edit', 'Edit');
        }
        if (!selectMode && window.OnigiriEngine && OnigiriEngine.clearMultiSelection) {
            try { OnigiriEngine.clearMultiSelection(); } catch (e) {}
        }
        if (selectMode) ensureEditToolbar();
        updateEditToolbar();
    }

    function selectedDids() {
        try { return Array.from(OnigiriEngine._multiSelectedDecks || []); } catch (e) { return []; }
    }

    function ensureEditToolbar() {
        if (document.getElementById('onigiri-edit-toolbar')) return;
        var bar = document.createElement('div');
        bar.id = 'onigiri-edit-toolbar';
        bar.innerHTML = '<button type="button" data-act="actions"></button>' +
            '<span class="onigiri-edit-count"></span>' +
            '<button type="button" data-act="done"></button>';
        bar.querySelector('[data-act="actions"]').textContent = t('actions', 'Actions');
        bar.querySelector('[data-act="done"]').textContent = t('done', 'Done');
        bar.addEventListener('click', function (event) {
            var b = event.target.closest('button[data-act]');
            if (!b) return;
            if (b.dataset.act === 'done') { setSelectMode(false); return; }
            var dids = selectedDids();
            if (!dids.length || !window.OnigiriEngine) return;
            var rect = b.getBoundingClientRect();
            if (dids.length > 1) OnigiriEngine.showBulkDeckContextMenu(rect.left, rect.top);
            else OnigiriEngine.showDeckContextMenu(rect.left, rect.top, dids[0]);
        });
        document.body.appendChild(bar);
    }

    function updateEditToolbar() {
        var bar = document.getElementById('onigiri-edit-toolbar');
        if (!bar) return;
        var n = selectedDids().length;
        bar.querySelector('.onigiri-edit-count').textContent = n ? n + ' ' + t('selected', 'selected') : t('select_decks', 'Select decks');
        bar.querySelector('[data-act="actions"]').disabled = n === 0;
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
        btn.textContent = t('edit', 'Edit');
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
        // a plain tap toggles one row (no Shift/Ctrl range semantics)
        OnigiriEngine.toggleMultiSelection(row, { shiftKey: false, ctrlKey: true, metaKey: true });
        haptic('selection');
        updateEditToolbar();
    }, true);


    // --- iOS sheets for Onigiri's menus -------------------------------------------
    // engine.js shows deck, sort and tag menus as .onigiri-quick-menu; on
    // phones positionMenu marks them .is-sheet. Here they get what an iOS
    // sheet has: a dimmed backdrop (tap to close), a grab handle, a swipe
    // down to dismiss and a Cancel button. Group rows (Markers ›) push their
    // items inside the sheet (CSS) instead of opening a fly-out.

    // The reviewer's answer bar is a separate web view below the card: tell
    // Python when a sheet is open so it can dim the bar (audit 2, R2-26).
    var sheetReported = false;
    function reportSheet(open) {
        if (!root.classList.contains('onigiri-screen-review') || sheetReported === open) return;
        sheetReported = open;
        try { if (window.pycmd) window.pycmd('onigiri_sheet_state:' + (open ? '1' : '0')); } catch (e) {}
    }

    function closeMenus() {
        reportSheet(false);
        if (window.OnigiriEngine && OnigiriEngine.closeQuickMenus) {
            try { OnigiriEngine.closeQuickMenus(); return; } catch (e) {}
        }
        document.querySelectorAll('.onigiri-quick-menu').forEach(function (m) { m.remove(); });
    }

    function backdrop() {
        var bd = document.getElementById('onigiri-sheet-backdrop');
        if (!bd) {
            bd = document.createElement('div');
            bd.id = 'onigiri-sheet-backdrop';
            bd.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                closeMenus();
            });
            document.body.appendChild(bd);
        }
        return bd;
    }

    function syncBackdrop() {
        var open = !!document.querySelector('body > .onigiri-quick-menu.is-sheet');
        var bd = document.getElementById('onigiri-sheet-backdrop');
        if (open) backdrop().classList.add('is-visible');
        else if (bd) bd.classList.remove('is-visible');
        root.classList.toggle('onigiri-sheet-open', open);
    }

    function enhanceSheet(menu) {
        if (menu.dataset.onigiriSheet) return;
        menu.dataset.onigiriSheet = '1';
        var grab = document.createElement('div');
        grab.className = 'onigiri-sheet-grabber';
        grab.setAttribute('aria-hidden', 'true');
        menu.insertBefore(grab, menu.firstChild);
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'onigiri-sheet-cancel';
        cancel.textContent = t('cancel', 'Cancel');
        // card and reviewer pages style bare buttons with !important
        [['background', 'var(--onigiri-surface-fill, var(--highlight-bg, rgba(127, 127, 127, 0.14)))'], ['color', 'var(--onigiri-surface-ink, var(--fg, inherit))'],
            ['border', '0'], ['box-shadow', 'none'], ['font-weight', '600'], ['font-size', '17px'],
            ['text-transform', 'none']].forEach(function (p) { cancel.style.setProperty(p[0], p[1], 'important'); });
        cancel.addEventListener('click', function (event) {
            event.stopPropagation();
            closeMenus();
        });
        menu.appendChild(cancel);
        haptic('light');
        swipeToDismiss(menu);
        // A sheet that fits has nothing to scroll: it takes the whole
        // gesture itself, so iOS doesn't claim the drag as a native pan
        // (which cancels pointer events and made the swipe snap back). One
        // that scrolls keeps native scrolling; its grab handle still drags.
        requestAnimationFrame(function () {
            if (menu.scrollHeight <= menu.clientHeight + 1) menu.style.touchAction = 'none';
        });
    }

    function swipeToDismiss(menu) {
        var start = null;
        var dy = 0;
        var moved = false;
        menu.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse') return;
            if (menu.scrollTop > 0 && !event.target.closest('.onigiri-sheet-grabber')) return;
            start = { y: event.clientY, t: Date.now() };
            dy = 0;
            moved = false;
        });
        menu.addEventListener('pointermove', function (event) {
            if (!start) return;
            dy = event.clientY - start.y;
            if (dy < 0 && !moved) { start = null; return; } // scrolling up the list
            if (dy > 8) moved = true;
            if (moved) {
                menu.style.transition = 'none';
                menu.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
            }
        });
        function end() {
            if (!start) return;
            var fast = dy > 40 && Date.now() - start.t < 250;
            start = null;
            if (!moved) return;
            menu.style.transition = '';
            if (dy > 110 || fast) {
                menu.style.transform = 'translateY(110%)';
                setTimeout(closeMenus, 180);
            } else {
                menu.style.transform = '';
            }
        }
        menu.addEventListener('pointerup', end);
        menu.addEventListener('pointercancel', end);
        // a drag that ends on a row must not run it
        menu.addEventListener('click', function (event) {
            if (moved) {
                moved = false;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }, true);
    }

    function watchSheets() {
        if (typeof MutationObserver === 'undefined' || !document.body) return;
        new MutationObserver(function (records) {
            var changed = false;
            for (var r = 0; r < records.length; r++) {
                var nodes = records[r].addedNodes;
                for (var n = 0; n < nodes.length; n++) {
                    var node = nodes[n];
                    if (node.nodeType === 1 && node.classList.contains('onigiri-quick-menu') &&
                        node.classList.contains('is-sheet')) enhanceSheet(node);
                }
                if (records[r].removedNodes.length || nodes.length) changed = true;
            }
            if (changed) syncBackdrop();
        }).observe(document.body, { childList: true });
    }

    // A sheet built here: from existing elements (the More actions; each row
    // runs the element's click) or from {label, icon (node), run} items.
    function elementItem(el) {
        var label = el.querySelector('span');
        var host = document.createElement('span');
        host.className = 'onigiri-action-icon-host ' + Array.prototype.filter.call(el.classList, function (c) {
            return c.indexOf('action-') === 0;
        }).join(' ');
        var icon = el.querySelector('.icon, .onigiri-dock-glyph, [style*="mask-image"], svg, img, i');
        if (icon) host.appendChild(icon.cloneNode(true));
        return {
            label: ((label ? label.textContent : '') || el.getAttribute('aria-label') ||
                el.getAttribute('title') || el.textContent || '').trim(),
            icon: host,
            run: function () { el.click(); },
        };
    }

    function showActionSheet(elements, anchor, title) {
        closeMenus();
        var menu = document.createElement('div');
        menu.className = 'onigiri-quick-menu onigiri-action-sheet';
        if (title) {
            // Every sheet says what it is about (audit NAV-01).
            var head = document.createElement('div');
            head.className = 'onigiri-sheet-title';
            head.textContent = title;
            menu.appendChild(head);
        }
        elements.forEach(function (entry) {
            if (entry && entry.sep) {
                var sep = document.createElement('div');
                sep.className = 'onigiri-sheet-sep';
                menu.appendChild(sep);
                return;
            }
            var item = entry && entry.run ? entry : elementItem(entry);
            if (!item.label) return;
            var row = document.createElement('div');
            row.className = 'quick-menu-item';
            if (item.icon) {
                if (!item.icon.classList.contains('onigiri-action-icon-host')) {
                    var wrap = document.createElement('span');
                    wrap.className = 'onigiri-action-icon-host';
                    wrap.appendChild(item.icon);
                    item.icon = wrap;
                }
                row.appendChild(item.icon);
            }
            var text = document.createElement('span');
            text.textContent = item.label;
            row.appendChild(text);
            row.addEventListener('click', function (event) {
                event.stopPropagation();
                closeMenus();
                item.run();
            });
            menu.appendChild(row);
        });
        var rect = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth - 20, bottom: 50 };
        if (window.OnigiriEngine && OnigiriEngine.positionMenu) {
            OnigiriEngine.positionMenu(menu, rect.left, rect.bottom);
        } else {
            // pages without engine.js (overview, reviewer): always a sheet,
            // closed by its backdrop, Cancel or a swipe
            menu.classList.add('is-sheet');
            document.body.appendChild(menu);
        }
        reportSheet(true);
    }

    // --- Home: action tiles ------------------------------------------------------------
    // Phones show one row of five tiles: the first four actions and More.
    // Settings, Onigiri Games and the old More fly-out (Get Shared, Create
    // Deck, Import) open from More as a labelled sheet.

    function setupActionTiles() {
        var section = document.querySelector('.modern-main-menu .onigiri-sidebar-actions-section');
        if (!section || section.dataset.onigiriTiles) return;
        section.dataset.onigiriTiles = '1';
        var items = Array.prototype.filter.call(section.children, function (el) {
            return el.classList.contains('menu-item');
        });
        var group = section.querySelector(':scope > details.menu-group');
        var overflow = items.slice(4);
        overflow.forEach(function (el) { el.classList.add('onigiri-action-overflow'); });
        var groupItems = group ? Array.prototype.slice.call(group.querySelectorAll('.menu-group-items > .menu-item')) : [];
        var summary = group && group.querySelector('summary');
        if (!summary) return;
        summary.addEventListener('click', function (event) {
            if (!root.classList.contains('onigiri-phone')) return;
            event.preventDefault();
            event.stopPropagation();
            group.open = false;
            showActionSheet(overflow.concat(groupItems), summary);
        }, true);
    }

    // --- Home: readable profile name ---------------------------------------------------
    // The name is drawn over the profile bar's colour; some themes paint
    // both in near shades (Catppuccin: lavender on lavender).

    function luminance(rgb) {
        var c = rgb.map(function (v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    function rgbOf(text) {
        var m = (text || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
        if (p.length > 3 && p[3] < 0.5) return null;
        return p.slice(0, 3);
    }

    function fixProfileContrast() {
        document.querySelectorAll('.profile-bar').forEach(function (bar) {
            var name = bar.querySelector('.profile-name');
            if (!name) return;
            var bg = rgbOf(getComputedStyle(bar).backgroundColor);
            var fg = rgbOf(getComputedStyle(name).color);
            if (!bg || !fg) return;
            var a = luminance(bg);
            var b = luminance(fg);
            var ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (ratio >= 3) return;
            name.style.setProperty('color', a > 0.4 ? '#1c1c1e' : '#ffffff', 'important');
        });
    }

    // --- Home: "Decks" as a large title -------------------------------------------------

    function titleCaseHeader() {
        var h = document.querySelector('#deck-list-header h2');
        if (!h || h.dataset.onigiriTitle) return;
        h.dataset.onigiriTitle = '1';
        var text = h.textContent.trim();
        if (/^[A-Z][A-Z ]+$/.test(text)) h.textContent = text.charAt(0) + text.slice(1).toLowerCase();
    }


    // --- Overview and reviewer: iOS navigation bar ----------------------------------
    // Phones: the row of seven circled toolbar icons becomes a nav bar with
    // ‹ (back: reviewer -> overview -> decks) and ⋯ (those actions as a
    // sheet). The reviewer's progress counter stays in the middle. The
    // header lives in a shadow root in the reviewer, so its buttons are
    // hidden with a style put inside it.

    var BACK_NAV_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 19-7-7 7-7"/></svg>';

    function goBack() {
        haptic('light');
        // Onigiri Settings: a page back to the list (the window itself
        // closes with Kioku's Back)
        if (document.querySelector('.osw-shell')) {
            root.classList.remove('onigiri-settings-page');
            return;
        }
        try { if (typeof pycmd === 'function') pycmd('onigiri_native:back'); } catch (e) {}
    }

    function headerRoots() {
        var roots = [document];
        var host = document.getElementById('onigiri-reviewer-ui-host');
        if (host && host.shadowRoot) roots.push(host.shadowRoot);
        return roots;
    }

    function headerButtons() {
        var out = [];
        headerRoots().forEach(function (r) {
            r.querySelectorAll('#onigiri-reviewer-header a.onigiri-reviewer-button, #onigiri-reviewer-header .onigiri-dock-item, ' +
                '#onigiri-reviewer-external-actions > *').forEach(function (el) {
                if (out.indexOf(el) < 0) out.push(el);
            });
        });
        return out;
    }

    // Header buttons that are app navigation (the deck list, Add, Browse, Stats,
    // Sync), not study tools.
    var NAV_COMMANDS = ['decks', 'add', 'browse', 'stats', 'sync'];

    function isAppNavigation(el) {
        var cmd = el.getAttribute && el.getAttribute('onclick') || '';
        for (var i = 0; i < NAV_COMMANDS.length; i++) {
            if (cmd.indexOf("pycmd('" + NAV_COMMANDS[i] + "')") >= 0) return true;
        }
        return false;
    }

    function studyToolButtons() {
        return headerButtons().filter(function (el) { return !isAppNavigation(el); });
    }

    function hideHeaderButtonsInShadow() {
        if (!root.classList.contains('onigiri-phone') || !root.classList.contains('onigiri-screen-review')) return;
        var host = document.getElementById('onigiri-reviewer-ui-host');
        var shadow = host && host.shadowRoot;
        if (!shadow || shadow.getElementById('onigiri-phone-nav-style')) return;
        var style = document.createElement('style');
        style.id = 'onigiri-phone-nav-style';
        // ids repeated: the header's own rules are !important too
        var H = '#onigiri-reviewer-header#onigiri-reviewer-header#onigiri-reviewer-header ';
        style.textContent =
            H + 'a.onigiri-reviewer-button.onigiri-reviewer-button,' +
            H + '.onigiri-rubber-dock.onigiri-rubber-dock,' +
            H + '.onigiri-dock-divider.onigiri-dock-divider,' +
            H + '#onigiri-reviewer-external-actions#onigiri-reviewer-external-actions{display:none!important}' +
            H + '.onigiri-reviewer-header-buttons.onigiri-reviewer-header-buttons{min-height:44px;justify-content:center!important}';
        shadow.appendChild(style);
    }

    function isOverviewPage() {
        return !!(document.body && (document.body.classList.contains('onigiri-overview') ||
            document.querySelector('.overview-bottom-actions, .congrats-bottom-actions, .congrats-container, #onigiri-overview-header')));
    }

    function setupNavBar() {
        if (!root.classList.contains('onigiri-phone') || document.getElementById('onigiri-phone-nav')) return;
        // Only Onigiri's own study screens: a card previewer or the card
        // layout window also shows a #qa card.
        var isReviewer = root.classList.contains('onigiri-screen-review');
        var isOverview = root.classList.contains('onigiri-screen-overview') && isOverviewPage();
        if (!isReviewer && !isOverview) return;
        var nav = document.createElement('nav');
        nav.id = 'onigiri-phone-nav';
        var back = document.createElement('button');
        back.type = 'button';
        back.className = 'onigiri-nav-back';
        back.setAttribute('aria-label', t('back', 'Back'));
        back.innerHTML = BACK_NAV_SVG + '<span>' + (isReviewer ? '' : t('decks', 'Decks')) + '</span>';
        back.addEventListener('click', goBack);
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'onigiri-nav-more';
        // The reviewer has its own card-actions ⋯ at the bottom; this one is
        // the study tools (Add, Browse, Hashi Notes, ...), so it gets a
        // different glyph and a titled sheet (audit NAV-01).
        more.setAttribute('aria-label', isReviewer ? t('study_tools', 'Study Tools') : t('more', 'More'));
        more.innerHTML = isReviewer ? TOOLS_SVG : MORE_SVG;
        more.addEventListener('click', function (event) {
            event.stopPropagation();
            if (isReviewer) {
                // Study tools only. Add, Browse, Stats and Sync live on the deck
                // list and the Menu tab (audit 2, R2-26).
                showActionSheet(studyToolButtons(), more, t('study_tools', 'Study Tools'));
                return;
            }
            // Overview: actions for this deck only. The buttons already on the
            // page (Options, Custom Study, Description) and the app's own
            // actions are not repeated here (audit 2, R2-25).
            var titleEl = document.querySelector('.overview-title, .overview-header h1, h1, h2');
            var deckName = titleEl ? titleEl.textContent.trim() : '';
            function deckRow(label, svg, action) {
                var icon = document.createElement('span');
                icon.innerHTML = svg;
                return {
                    label: label,
                    icon: icon,
                    run: function () { try { if (window.pycmd) window.pycmd('onigiri_overview_menu:' + action); } catch (e) {} },
                };
            }
            showActionSheet([
                deckRow(t('rename_deck_title', 'Rename Deck'), RENAME_SVG, 'rename'),
                deckRow(t('ctx_deck_options', 'Deck Options'), OPTIONS_SVG, 'options'),
                deckRow(t('ctx_export_deck', 'Export Deck'), EXPORT_SVG, 'export'),
            ], more, deckName || t('more', 'More'));
        });
        nav.appendChild(back);
        nav.appendChild(more);
        document.body.appendChild(nav);
        root.classList.add('onigiri-has-phone-nav');
        // A background for the bar once the page has scrolled under it (R2-03).
        var scrolled = false;
        window.addEventListener('scroll', function () {
            var now = (window.scrollY || document.documentElement.scrollTop || 0) > 4;
            if (now !== scrolled) {
                scrolled = now;
                root.classList.toggle('onigiri-nav-scrolled', now);
            }
        }, { passive: true });
        hideHeaderButtonsInShadow();
        function toolsButtonVisibility() {
            // No Hashi Notes, Pomodoro or add-on buttons: nothing to open.
            if (isReviewer) more.style.display = studyToolButtons().length ? '' : 'none';
        }
        toolsButtonVisibility();
        // the reviewer mounts its header after load
        var tries = 0;
        var timer = setInterval(function () {
            hideHeaderButtonsInShadow();
            toolsButtonVisibility();
            if (++tries > 20) clearInterval(timer);
        }, 250);
    }

    // --- Swipe from the left edge to go back (as in iOS navigation) -----------------

    function setupEdgeSwipe() {
        if (!root.classList.contains('onigiri-touch')) return;
        if (document.documentElement.dataset.onigiriEdgeSwipe) return;
        var isReviewer = root.classList.contains('onigiri-screen-review');
        var isSettings = !!document.querySelector('.osw-shell');
        var isOverview = root.classList.contains('onigiri-screen-overview');
        if (!isReviewer && !isSettings && !isOverview) return;
        document.documentElement.dataset.onigiriEdgeSwipe = '1';
        var start = null;
        var cue = null;
        document.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) return;
            var touch = event.touches[0];
            start = touch.clientX <= 22 ? { x: touch.clientX, y: touch.clientY } : null;
            if (start && isSettings && !root.classList.contains('onigiri-settings-page')) start = null;
        }, { passive: true });
        document.addEventListener('touchmove', function (event) {
            if (!start) return;
            var touch = event.touches[0];
            var dx = touch.clientX - start.x;
            var dy = Math.abs(touch.clientY - start.y);
            if (dy > 40 && dy > dx) { start = null; if (cue) cue.remove(); cue = null; return; }
            if (dx > 12) {
                if (!cue) {
                    cue = document.createElement('div');
                    cue.id = 'onigiri-edge-cue';
                    cue.innerHTML = BACK_NAV_SVG;
                    document.body.appendChild(cue);
                }
                cue.style.top = (touch.clientY - 22) + 'px';
                cue.style.transform = 'translateX(' + Math.min(dx, 90) + 'px)';
                cue.classList.toggle('is-armed', dx > 80);
            }
        }, { passive: true });
        document.addEventListener('touchend', function (event) {
            if (!start) return;
            var touch = event.changedTouches[0];
            var dx = touch.clientX - start.x;
            start = null;
            if (cue) { cue.remove(); cue = null; }
            if (dx > 80) goBack();
        }, { passive: true });
        document.addEventListener('touchcancel', function () {
            start = null;
            if (cue) { cue.remove(); cue = null; }
        }, { passive: true });
    }

    // --- Profile (phones): one slide up per open ----------------------------------
    // A CSS animation on the panel could replay when iOS restyled the page
    // around it (two pop-ups); a Web Animation runs exactly once.

    function watchProfile() {
        var sidebar = document.querySelector('.sidebar-left');
        if (!sidebar || sidebar.dataset.onigiriProfileWatch || typeof MutationObserver === 'undefined') return;
        sidebar.dataset.onigiriProfileWatch = '1';
        var wasOpen = sidebar.classList.contains('profile-sidebar-open');
        new MutationObserver(function () {
            var open = sidebar.classList.contains('profile-sidebar-open');
            if (open === wasOpen) return;
            wasOpen = open;
            root.classList.toggle('onigiri-profile-open', open);
            var panel = sidebar.querySelector('.onigiri-sidebar-profile');
            if (!open || !panel || !root.classList.contains('onigiri-phone') || !panel.animate) return;
            if (mq('(prefers-reduced-motion: reduce)')) return;
            panel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
                { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
        }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    // --- Profile (phones): swipe down from the top to close -----------------------

    (function () {
        var start = null;
        document.addEventListener('touchstart', function (event) {
            var panel = event.target.closest && event.target.closest('.profile-sidebar-open .onigiri-sidebar-profile');
            if (!panel || !root.classList.contains('onigiri-phone') || panel.scrollTop > 0 || event.touches.length !== 1) {
                start = null;
                return;
            }
            start = { y: event.touches[0].clientY, panel: panel, dy: 0 };
        }, { passive: true });
        document.addEventListener('touchmove', function (event) {
            if (!start) return;
            start.dy = event.touches[0].clientY - start.y;
            if (start.dy > 0 && start.panel.scrollTop <= 0) {
                start.panel.style.transition = 'none';
                start.panel.style.transform = 'translateY(' + start.dy + 'px)';
            }
        }, { passive: true });
        function end() {
            if (!start) return;
            var s = start;
            start = null;
            s.panel.style.transition = '';
            if (s.dy > 120) {
                s.panel.style.transform = 'translateY(100%)';
                setTimeout(function () {
                    s.panel.style.transform = '';
                    if (window.OnigiriProfileSidebar && OnigiriProfileSidebar.close) OnigiriProfileSidebar.close();
                    else if (window.OnigiriProfileSidebar && OnigiriProfileSidebar.toggle) OnigiriProfileSidebar.toggle();
                }, 180);
            } else {
                s.panel.style.transform = '';
            }
        }
        document.addEventListener('touchend', end, { passive: true });
        document.addEventListener('touchcancel', end, { passive: true });
    })();

    // --- Reviewer bottom bar: haptics on answer --------------------------------------

    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse') return;
        var b = event.target.closest && event.target.closest('#outer button[data-onigiri-ease], #outer .onigiri-show-answer-btn');
        if (b) haptic(b.hasAttribute('data-onigiri-ease') ? 'medium' : 'light');
    }, true);


    // --- Anki's menus as a full-screen page -------------------------------------------
    // The Menu tab / Menu row: File, Edit, View, Tools, Help and Onigiri as
    // an iOS list page (webview_handlers.show_app_menu sends the tree);
    // a submenu pushes its own page with ‹ back, an item runs and closes.

    var CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
    var CHECK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4L19 7"/></svg>';

    function closeAppMenu() {
        var page = document.getElementById('onigiri-app-menu');
        if (!page) return;
        page.classList.add('is-closing');
        root.classList.remove('onigiri-app-menu-open');
        setTimeout(function () { page.remove(); }, 260);
    }

    function showAppMenu(data) {
        closeMenus();
        var old = document.getElementById('onigiri-app-menu');
        if (old) old.remove();
        var page = document.createElement('div');
        page.id = 'onigiri-app-menu';
        page.setAttribute('role', 'dialog');
        page.innerHTML = '<div class="oam-bar"><button type="button" class="oam-back"></button>' +
            '<div class="oam-title"></div><button type="button" class="oam-done"></button></div>' +
            '<div class="oam-body"></div>';
        var stack = [{ title: (data && data.title) || t('menu', 'Menu'), items: (data && data.items) || [] }];
        var backBtn = page.querySelector('.oam-back');
        var doneBtn = page.querySelector('.oam-done');
        var title = page.querySelector('.oam-title');
        var body = page.querySelector('.oam-body');
        doneBtn.textContent = t('done', 'Done');
        doneBtn.addEventListener('click', closeAppMenu);
        backBtn.addEventListener('click', function () {
            if (stack.length > 1) { stack.pop(); render(-1); haptic('light'); }
        });

        function render(direction) {
            var level = stack[stack.length - 1];
            title.textContent = level.title;
            if (stack.length > 1) {
                backBtn.innerHTML = BACK_NAV_SVG + '<span></span>';
                backBtn.querySelector('span').textContent = stack[stack.length - 2].title;
                backBtn.style.visibility = 'visible';
            } else {
                backBtn.innerHTML = '';
                backBtn.style.visibility = 'hidden';
            }
            body.innerHTML = '';
            var list = document.createElement('div');
            list.className = 'oam-list' + (direction > 0 ? ' is-push' : direction < 0 ? ' is-pop' : '');
            var group = null;
            level.items.forEach(function (item) {
                if (item.sep) { group = null; return; }
                if (item.head) {
                    // A titled group ("Library", "Maintenance", ...).
                    var head = document.createElement('div');
                    head.className = 'oam-group-title';
                    head.textContent = item.head;
                    list.appendChild(head);
                    group = null;
                    return;
                }
                if (!group) {
                    group = document.createElement('div');
                    group.className = 'oam-group';
                    list.appendChild(group);
                }
                var row = document.createElement('button');
                row.type = 'button';
                row.className = 'oam-row' + (item.en === false ? ' is-disabled' : '');
                var label = document.createElement('span');
                label.className = 'oam-label';
                label.textContent = item.t;
                row.appendChild(label);
                if (item.sub) {
                    row.insertAdjacentHTML('beforeend', '<span class="oam-chevron">' + CHEVRON_SVG + '</span>');
                } else if (item.chk) {
                    row.insertAdjacentHTML('beforeend', '<span class="oam-check">' + CHECK_SVG + '</span>');
                }
                row.addEventListener('click', function () {
                    if (item.sub) {
                        stack.push({ title: item.t, items: item.sub });
                        haptic('light');
                        render(1);
                        return;
                    }
                    if (item.en === false) return;
                    haptic('light');
                    closeAppMenu();
                    // A page command (Create Deck, Get Shared) or a menu action.
                    try { pycmd(item.cmd ? item.cmd : 'onigiri_app_menu_run:' + item.id); } catch (e) {}
                });
                group.appendChild(row);
            });
            body.appendChild(list);
            body.scrollTop = 0;
        }

        render(0);
        document.body.appendChild(page);
        root.classList.add('onigiri-app-menu-open');
    }

    // --- Keyboard: fixed bottom bars get out of the way ---------------------------
    // With a text field focused the keyboard covers the bottom of the screen,
    // and the tab bar / Edit toolbar floated over the content above it.

    var TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=color]), textarea, [contenteditable="true"]';
    var kbdTimer = null;

    document.addEventListener('focusin', function (event) {
        if (!event.target.matches || !event.target.matches(TEXT_FIELD)) return;
        clearTimeout(kbdTimer);
        root.classList.add('onigiri-keyboard');
    });
    document.addEventListener('focusout', function () {
        clearTimeout(kbdTimer);
        // focus often moves straight to another field
        kbdTimer = setTimeout(function () {
            var a = document.activeElement;
            if (!(a && a.matches && a.matches(TEXT_FIELD))) root.classList.remove('onigiri-keyboard');
        }, 120);
    });

    // --- Phone tab bar (deck browser) --------------------------------------------

    var TAB_KEY = 'onigiriPhoneTab';

    function readTab() {
        try { return sessionStorage.getItem(TAB_KEY) || 'decks'; } catch (e) { return 'decks'; }
    }

    var TAB_ORDER = { decks: 0, home: 1 };
    var currentTab = null;

    // The pane coming in slides from the side of its tab (Decks is left of
    // Home, Home left of Menu), like paging between tabs.
    function slidePane(tab, from) {
        var sel = tab === 'home'
            ? '.container.modern-main-menu .main-content, .ba-side'
            : '.container.modern-main-menu .sidebar-left, .ba-home';
        var pane = document.querySelector(sel);
        if (!pane) return;
        var cls = from === 'right' ? 'onigiri-slide-from-right' : 'onigiri-slide-from-left';
        pane.classList.remove('onigiri-slide-from-right', 'onigiri-slide-from-left');
        void pane.offsetWidth;
        pane.classList.add(cls);
        pane.addEventListener('animationend', function done() {
            pane.classList.remove(cls);
            pane.removeEventListener('animationend', done);
        });
    }

    var homeRevealed = false;

    function applyTab(tab) {
        var previous = currentTab;
        currentTab = tab;
        if (tab === 'home' && !homeRevealed && previous) {
            homeRevealed = true;
            root.classList.add('onigiri-reveal-home');
            setTimeout(function () { root.classList.remove('onigiri-reveal-home'); }, 800);
        }
        if (previous && previous !== tab && root.classList.contains('onigiri-phone')) {
            slidePane(tab, TAB_ORDER[tab] > TAB_ORDER[previous] ? 'right' : 'left');
        }
        root.classList.toggle('onigiri-phone-tab-decks', tab !== 'home');
        root.classList.toggle('onigiri-phone-tab-home', tab === 'home');
        var bar = document.getElementById('onigiri-phone-tabs');
        if (bar) {
            bar.querySelectorAll('button[data-tab]').forEach(function (b) {
                b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
            });
        }
        try { sessionStorage.setItem(TAB_KEY, tab); } catch (e) {}
        // Widgets that measure themselves (heatmap, grid) have ResizeObservers
        // and reflow when their pane becomes visible. A fake window resize
        // here woke every resize listener in the page during the slide.
    }

    var DECKS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M7 4h10"/></svg>';
    var HOME_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/></svg>';

    var MENU_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';

    // --- Deck list: Add / Browse / Stats / Sync always in reach (audit NAV-02) --
    // With the sidebar actions "archived", Anki's most used actions sat behind
    // a small house icon that collided with the Home tab. On phones they get a
    // labelled row under the deck list header instead; the rest of that sheet
    // (Create Deck, Import, Settings, games…) lives on the Menu tab.
    var QUICK_ICONS = {
        add: '<path d="M12 5v14M5 12h14"/>',
        browse: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 4v16"/>',
        stats: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
        sync: '<path d="M20 11a8 8 0 0 0-14.6-4.4L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.4L20 16"/><path d="M20 20v-4h-4"/>'
    };

    function addQuickActions() {
        if (!root.classList.contains('onigiri-phone')) return;
        var home = document.getElementById('onigiri-home-toolbar-btn');
        var header = document.getElementById('deck-list-header');
        if (!home || !header || document.getElementById('onigiri-quick-actions')) return;
        var row = document.createElement('div');
        row.id = 'onigiri-quick-actions';
        row.setAttribute('role', 'toolbar');
        [['add', 'add', t('add', 'Add')], ['browse', 'browse', t('browse', 'Browse')],
         ['stats', 'stats', t('stats', 'Stats')], ['sync', 'sync', t('sync', 'Sync')]].forEach(function (spec) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'onigiri-quick-action' + (spec[0] === 'sync' ? ' action-sync' : '');
            b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                QUICK_ICONS[spec[0]] + '</svg><span>' + spec[2] + '</span>';
            b.addEventListener('click', function () {
                if (typeof pycmd === 'function') pycmd(spec[1]);
            });
            row.appendChild(b);
        });
        header.parentNode.insertBefore(row, header.nextSibling);
        home.classList.add('onigiri-replaced');
        // The red dot on Sync means there are changes to send: say so in words
        // and for VoiceOver (audit 2, R2-31).
        var syncBtn = row.querySelector('.action-sync');
        if (syncBtn && window.MutationObserver) {
            var paintSync = function () {
                var needed = syncBtn.classList.contains('sync-needed');
                var caption = syncBtn.querySelector('span');
                if (caption) caption.textContent = needed ? t('sync_needed', 'To sync') : t('sync', 'Sync');
                syncBtn.setAttribute('aria-label', needed ? t('sync_changes_to_sync', 'Sync: changes to sync') : t('sync', 'Sync'));
            };
            new MutationObserver(paintSync).observe(syncBtn, { attributes: true, attributeFilter: ['class'] });
            paintSync();
        }
    }

    function addPhoneTabs() {
        // Classic/Shima home (.modern-main-menu) or the Kome theme (.ba-side).
        var container = document.querySelector('.container.modern-main-menu, .ba-side');
        if (!container || document.getElementById('onigiri-phone-tabs')) return;
        var bar = document.createElement('nav');
        bar.id = 'onigiri-phone-tabs';
        bar.setAttribute('role', 'tablist');
        // The Shima theme is only a deck island: it has no widget pane, so
        // a Home tab led to a blank screen.
        // (Kome builds .ba-side first, .ba-home may follow)
        var hasHome = !!document.querySelector('.main-content, .ba-home, .ba-side');
        [
            ['decks', DECKS_SVG, t('decks', 'Decks')],
            hasHome ? ['home', HOME_SVG, t('home', 'Home')] : null,
            ['menu', MENU_SVG, t('menu', 'Menu')],
        ].filter(Boolean).forEach(function (spec) {
            var b = document.createElement('button');
            b.type = 'button';
            b.dataset.tab = spec[0];
            b.setAttribute('role', 'tab');
            b.innerHTML = spec[1] + '<span>' + spec[2] + '</span>';
            if (spec[0] === 'menu') {
                // Not a tab: Anki's menus (File, Tools, Help, ...) as a
                // popup, since the desktop menu row is hidden on phones.
                b.removeAttribute('role');
                b.addEventListener('click', function () {
                    if (typeof pycmd === 'function') pycmd('onigiri_app_menu');
                });
            } else {
                b.addEventListener('click', function () { applyTab(spec[0]); });
            }
            bar.appendChild(b);
        });
        document.body.appendChild(bar);
        root.classList.add('onigiri-has-phone-tabs');
        applyTab(hasHome ? readTab() : 'decks');
    }

    // --- Onigiri Settings on phones: list -> page drill-down --------------------

    var BACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

    // --- Settings on phones: segmented choices that do not fit become a list --
    // Equal-width segments cut long labels mid-word ("Custor", "Righ"). After
    // each render, a control whose options still overflow is shown as a
    // vertical list instead (CSS .is-list).
    function fitSegments() {
        if (!root.classList.contains('onigiri-phone')) return;
        document.querySelectorAll('.osw-shell .osw-segmented-control').forEach(function (ctl) {
            if (ctl.closest('.osw-subtabs') || !ctl.offsetParent) return;
            ctl.classList.remove('is-list');
            var tooWide = ctl.scrollWidth > ctl.clientWidth + 1;
            if (!tooWide) {
                var buttons = ctl.querySelectorAll(':scope > .osw-segment-btn');
                for (var i = 0; i < buttons.length && !tooWide; i++) {
                    var b = buttons[i];
                    var label = b.querySelector('.osw-segment-label') || b;
                    if (b.scrollWidth > b.clientWidth + 1 || label.scrollWidth > label.clientWidth + 1) tooWide = true;
                    // A label that had to wrap onto three lines is also too cramped.
                    else if (b.clientHeight > 58) tooWide = true;
                }
            }
            if (tooWide) ctl.classList.add('is-list');
        });
    }

    // Pomodoro Sound listed "Start tone" and "End tone" twice: as pickers and
    // again as Preview rows. On phones the preview's play button moves onto
    // the picker's row and the extra row goes away (the button keeps its own
    // handler, so it still plays the tone).
    function mergeToneRows() {
        [['pomodoro_start_sound', 'pomodoro_test_start_sound_action'],
         ['pomodoro_end_sound', 'pomodoro_test_end_sound_action']].forEach(function (pair) {
            var pick = document.querySelector('[data-field-host="' + pair[0] + '"]');
            var test = document.querySelector('[data-field-host="' + pair[1] + '"]');
            if (!pick || !test || test.dataset.onigiriMerged) return;
            var btn = test.querySelector('button');
            if (!btn) return;
            var holder = pick.querySelector('.osw-row-control') || pick;
            btn.classList.add('onigiri-tone-play');
            btn.setAttribute('aria-label', (btn.textContent || '').trim() || 'Preview');
            holder.appendChild(btn);
            test.dataset.onigiriMerged = '1';
            test.style.display = 'none';
        });
    }

    function watchSegments() {
        var shell = document.querySelector('.osw-shell');
        if (!shell || shell.dataset.onigiriSegWatch || !window.MutationObserver) return;
        shell.dataset.onigiriSegWatch = '1';
        var pending = false;
        var schedule = function () {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () { pending = false; fitSegments(); mergeToneRows(); markScrollableStrips(); });
        };
        new MutationObserver(schedule).observe(shell, { childList: true, subtree: true });
        window.addEventListener('resize', schedule);
        // A tab strip that scrolls sideways fades at its right edge while there
        // is more to see (audit 2, R2-23).
        shell.addEventListener('scroll', function (event) {
            var t = event.target;
            if (t && t.classList && t.classList.contains('is-scrollable')) markScrollEdge(t);
        }, true);
        schedule();
    }

    function markScrollEdge(strip) {
        strip.classList.toggle('is-at-end', strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2);
    }

    function markScrollableStrips() {
        var strips = document.querySelectorAll('.osw-shell .osw-subtabs, .osw-shell .osw-subtabs-strip');
        for (var i = 0; i < strips.length; i++) {
            var strip = strips[i];
            var scrolls = strip.scrollWidth > strip.clientWidth + 2;
            strip.classList.toggle('is-scrollable', scrolls);
            if (scrolls) markScrollEdge(strip);
        }
    }

    function setupSettingsDrillDown() {
        var shell = document.querySelector('.osw-shell');
        if (!shell || shell.dataset.onigiriDrill) return;
        shell.dataset.onigiriDrill = '1';
        var row = document.querySelector('.osw-page-head-row');
        if (row && !row.querySelector('.onigiri-settings-back')) {
            var back = document.createElement('button');
            back.type = 'button';
            back.className = 'onigiri-settings-back';
            back.innerHTML = BACK_SVG + '<span>' + t('settings_title', 'Settings') + '</span>';
            back.addEventListener('click', function () {
                root.classList.remove('onigiri-settings-page');
            });
            row.insertBefore(back, row.firstChild);
        }
        // With Kioku's own title bar off (settings_web/dialog.py asks for that),
        // the list needs its own header: a title and the Done that closes the
        // window. Shown only when the dialog adds .onigiri-own-header.
        var rail = document.getElementById('oswRail');
        if (rail && !rail.querySelector('.onigiri-settings-bar')) {
            var bar = document.createElement('div');
            bar.className = 'onigiri-settings-bar';
            var title = document.createElement('span');
            title.className = 'onigiri-settings-bar-title';
            title.textContent = t('settings_title', 'Settings');
            var done = document.createElement('button');
            done.type = 'button';
            done.className = 'onigiri-settings-done';
            done.textContent = t('done', 'Done');
            done.addEventListener('click', function () {
                var real = document.getElementById('oswDone');
                if (real) real.click();
            });
            bar.appendChild(title);
            bar.appendChild(done);
            rail.insertBefore(bar, rail.firstChild);
        }
        // Opening a page (nav item or search result) shows it full width.
        shell.addEventListener('click', function (event) {
            if (event.target.closest('[data-nav-item], .osw-search-results [data-page], .osw-search-result')) {
                root.classList.add('onigiri-settings-page');
                // showPage() reset the scroll while .osw-main was still hidden,
                // and WebKit ignores scroll positions on hidden elements, so a
                // newly opened page started where the last one ended. Reset it
                // now that the page is visible, but leave search-result jumps
                // (which scroll to their target) alone.
                if (event.target.closest('[data-nav-item]')) {
                    var resetScroll = function () {
                        var scroller = document.getElementById('oswPageScroll');
                        if (scroller) scroller.scrollTop = 0;
                    };
                    resetScroll();
                    requestAnimationFrame(resetScroll);
                }
            }
        });
        var search = shell.querySelector('.osw-search input');
        if (search) {
            search.addEventListener('input', function () {
                if (search.value.trim()) root.classList.add('onigiri-settings-page');
            });
        }
    }

    // --- App feel: no pinch-zoom on Onigiri's own screens ----------------------
    // A pinch or a drag moved the whole home screen around like a web page.
    // Reviewer cards (#qa) keep pinch-zoom (images, small print). Kioku keeps
    // the page's own viewport in data-kioku-viewport and scales it by its
    // "User interface size" (kioku/webscripts.py ZOOM_JS), so the limits are
    // set there and in the live tag, scaled by the current zoom.
    var NO_ZOOM = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';

    function lockZoom() {
        if (!root.classList.contains('onigiri-mobile')) return;
        if (document.getElementById('qa')) return;
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            if (!document.head) return;
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }
        if (meta.hasAttribute('data-kioku-viewport')) meta.setAttribute('data-kioku-viewport', NO_ZOOM);
        var z = Number(window.__kiokuZoom) || 1;
        meta.content = z === 1 ? NO_ZOOM
            : 'initial-scale=' + z + ', minimum-scale=' + z + ', maximum-scale=' + z + ', user-scalable=no';
    }

    function onReady() {
        updateClasses();
        lockZoom();
        stripHover();
        watchStylesheets();
        paintEdges();
        nativeCmd('ready');
        setupSettingsDrillDown();
        watchSegments();
        addQuickActions();
        addPhoneTabs();
        addSelectToggle();
        decorateDeckRows();
        watchSheets();
        watchProfile();
        setupNavBar();
        setupEdgeSwipe();
        // injector.js adds the house button after load
        [0, 300, 1200].forEach(function (ms) { setTimeout(addQuickActions, ms); });
        if (root.classList.contains('onigiri-touch')) {
            setupActionTiles();
            titleCaseHeader();
            fixProfileContrast();
        }
        // Kome builds its sidebar after load: add the tabs once it appears.
        if (!document.getElementById('onigiri-phone-tabs') && typeof MutationObserver !== 'undefined' && document.body) {
            var tabsObserver = new MutationObserver(function () {
                if (document.querySelector('.container.modern-main-menu, .ba-side')) {
                    tabsObserver.disconnect();
                    addPhoneTabs();
                }
            });
            tabsObserver.observe(document.body, { childList: true, subtree: true });
            setTimeout(function () { tabsObserver.disconnect(); }, 10000);
        }
        var container = document.getElementById('deck-list-container');
        if (container && typeof MutationObserver !== 'undefined') {
            new MutationObserver(function () {
                decorateDeckRows();
                updateEditToolbar();
            }).observe(container, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
    // deck rows ease in once when the page is drawn
    if (root.classList.contains('onigiri-screen-decks') && root.classList.contains('onigiri-touch')) {
        root.classList.add('onigiri-first-paint');
        setTimeout(function () { root.classList.remove('onigiri-first-paint'); }, 900);
    }
    window.addEventListener('load', function () {
        stripHover();
        paintEdges();
        // themes and backgrounds settle after load
        setTimeout(paintEdges, 600);
        setupNavBar();
        setupEdgeSwipe();
    });

    window.OnigiriMobile = {
        isTouch: function () { return root.classList.contains('onigiri-touch'); },
        isPhone: function () { return root.classList.contains('onigiri-phone'); },
        longPress: function (selector) {
            if (selector && longPressSelectors.indexOf(selector) < 0) longPressSelectors.push(selector);
        },
        setSelectMode: setSelectMode,
        showTab: applyTab,
        showActionSheet: showActionSheet,
        showAppMenu: showAppMenu,
        closeAppMenu: closeAppMenu,
        closeMenus: closeMenus,
        refresh: function () { updateClasses(); decorateDeckRows(); addSelectToggle(); stripHover(); paintEdges(); },
        haptic: haptic,
        paintEdges: paintEdges,
        findOverflow: findOverflow,
        hideHeaderButtonsInShadow: hideHeaderButtonsInShadow,
        fitSegments: fitSegments,
    };
})();
