(function () {
    if (window.BingsuRenameDialog) return;

    var state = {
        deckId: null,
        leafName: '',
        fullName: '',
        parentPrefix: '',
        fullPath: false,
        cleanupFns: []
    };

    function T(key, fallback) {
        if (window.BingsuI18n && typeof BingsuI18n.t === 'function') {
            return BingsuI18n.t(key, fallback);
        }
        return fallback;
    }

    function addCleanup(fn) {
        state.cleanupFns.push(fn);
    }

    function runCleanup() {
        while (state.cleanupFns.length) {
            var fn = state.cleanupFns.pop();
            try { fn(); } catch (_) {}
        }
    }

    function iconUrl(name) {
        if (window.BingsuEngine && typeof BingsuEngine.systemIconUrl === 'function') {
            return BingsuEngine.systemIconUrl(name);
        }
        return '../system_files/system_icons/unavailable_for_users/' + name;
    }

    function resolveIconUrl(iconRef) {
        var url = String(iconRef || '');
        if (!url) return '';
        if (url.indexOf('/') !== -1) return url;
        if (window.BingsuEngine && typeof BingsuEngine.systemIconUrl === 'function') {
            return BingsuEngine.systemIconUrl(url);
        }
        return url;
    }

    function makeIcon(iconRef, className, size, color) {
        if (window.BingsuEngine && typeof BingsuEngine.createMaskIcon === 'function') {
            return BingsuEngine.createMaskIcon(resolveIconUrl(iconRef), {
                className: className || '',
                size: size || 16,
                color: color || 'currentColor'
            });
        }
        var fallback = document.createElement('span');
        fallback.className = className || '';
        return fallback;
    }

    function preloadCommonIcons() {
        var urls = ['rename.svg', 'cancel.svg'].map(iconUrl);
        if (window.BingsuEngine && typeof BingsuEngine.preloadMaskIcons === 'function') {
            BingsuEngine.preloadMaskIcons(urls);
        }
        return urls.map(function (url) {
            var img = new Image();
            img.decoding = 'async';
            img.src = url;
            return img;
        });
    }

    // Shared light/dark tokens for Bingsu dialogs. They read the Bingsu palette
    // (which flips on .night-mode) instead of Anki's --canvas*, so a dialog can
    // never end up with light-theme surfaces under dark-theme text.
    function ensureDialogThemeTokens() {
        if (document.getElementById('bingsu-dialog-theme-tokens')) return;
        var tokenStyle = document.createElement('style');
        tokenStyle.id = 'bingsu-dialog-theme-tokens';
        tokenStyle.textContent = [
            ':root{--odlg-surface:#ffffff;--odlg-inset:#ffffff;',
            '  --odlg-fg:#202124;--odlg-fg-subtle:#6f7177;',
            '  --odlg-border:#dcdde1;--odlg-highlight:#f2f2f2;--odlg-hover:#e9e9e9;',
            '  --odlg-accent:var(--accent-color,#0077C8);--odlg-scrim:rgba(0,0,0,0.45);}',
            '.night-mode,.nightMode{--odlg-surface:#242424;--odlg-inset:#242424;',
            '  --odlg-fg:#f4f4f5;--odlg-fg-subtle:#c4c4c4;',
            '  --odlg-border:#454545;--odlg-highlight:#303030;--odlg-hover:#3a3a3a;',
            '  --odlg-accent:var(--accent-color,#0077C8);--odlg-scrim:rgba(0,0,0,0.62);}'
        ].join('');
        (document.head || document.documentElement).appendChild(tokenStyle);
    }

    function ensureStyles() {
        ensureDialogThemeTokens();
        if (document.getElementById('bingsu-rename-dialog-style')) return;
        var style = document.createElement('style');
        style.id = 'bingsu-rename-dialog-style';
        style.textContent = [
            '#bingsu-rename-backdrop{position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;',
            '  background:var(--odlg-scrim, rgba(0,0,0,0.58));contain:layout paint style;isolation:isolate;transform:translateZ(0);',
            '  backface-visibility:hidden;-webkit-backface-visibility:hidden;}',
            '#bingsu-rename-backdrop.is-preparing{visibility:hidden;}',
            '#bingsu-rename-backdrop *{box-sizing:border-box;}',
            '#bingsu-rename-backdrop button,#bingsu-rename-backdrop input{appearance:none;-webkit-appearance:none;',
            '  font-family:var(--font-main,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif);}',
            '#bingsu-rename-backdrop button{border:none !important;outline:none !important;box-shadow:none !important;background-image:none !important;}',
            '.bingsu-rename-modal{width:460px;max-width:94vw;display:flex;flex-direction:column;overflow:hidden;',
            '  border-radius:16px;border:1px solid var(--odlg-border, rgba(0,0,0,0.14));',
            '  background:var(--odlg-surface, #ffffff);color:var(--odlg-fg, #212121);',
            '  box-shadow:0 24px 70px rgba(0,0,0,0.42);backface-visibility:hidden;-webkit-backface-visibility:hidden;',
            '  transform:translateZ(0);contain:layout paint style;isolation:isolate;}',
            '.bingsu-rename-header{display:flex;align-items:flex-start;gap:12px;padding:18px 18px 14px;border-bottom:1px solid var(--odlg-border, rgba(0,0,0,0.14));}',
            '.bingsu-rename-header-icon{width:34px;height:34px;min-width:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;',
            '  color:var(--odlg-accent, #0077C8);background:var(--odlg-highlight, rgba(0,0,0,0.06));}',
            '.bingsu-rename-title-wrap{min-width:0;flex:1;}',
            '.bingsu-rename-title{font-size:16px;font-weight:700;line-height:1.2;margin:0 0 5px;color:var(--odlg-fg, #212121);}',
            '.bingsu-rename-subtitle{font-size:13px;color:var(--odlg-fg-subtle, #757575);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.bingsu-rename-close{width:30px;height:30px;min-width:30px;padding:0;border:none !important;border-radius:8px;background:transparent !important;color:var(--odlg-fg-subtle, #757575);',
            '  display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none !important;box-shadow:none !important;filter:none !important;',
            '  opacity:1;transition:none;}',
            '.bingsu-rename-close:hover,.bingsu-rename-close:focus,.bingsu-rename-close:active{background:transparent !important;color:var(--odlg-fg-subtle, #757575);opacity:1;box-shadow:none !important;border:none !important;filter:none !important;}',
            '.bingsu-rename-body{padding:16px 18px 12px;}',
            '.bingsu-rename-label{font-size:11px;font-weight:700;color:var(--odlg-fg-subtle, #757575);margin:0 0 8px;text-transform:uppercase;}',
            '.bingsu-rename-input-wrap{position:relative;}',
            '.bingsu-rename-input{width:100%;height:40px;padding:0 13px;border-radius:999px;border:1px solid var(--odlg-border, rgba(0,0,0,0.14));',
            '  background:var(--odlg-inset, #ffffff);color:var(--odlg-fg, #212121);font-size:13px;outline:none;box-shadow:none;',
            '  transition:none;}',
            '.bingsu-rename-input::placeholder{color:var(--odlg-fg-subtle, #757575);}',
            '.bingsu-rename-input:hover{background:var(--odlg-inset, #ffffff);}',
            '.bingsu-rename-input:focus{border-color:var(--odlg-accent, #0077C8);}',
            '.bingsu-rename-hint{font-size:12px;color:var(--odlg-fg-subtle, #757575);line-height:1.35;margin-top:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.bingsu-rename-error{display:none;margin:0 18px 10px;padding:9px 11px;border-radius:9px;background:rgba(192,48,48,0.12);',
            '  color:#d84a4a;font-size:12px;line-height:1.35;}',
            '.bingsu-rename-footer{display:flex;align-items:center;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--odlg-border, rgba(0,0,0,0.14));}',
            '.bingsu-rename-spacer{flex:1;}',
            '.bingsu-rename-btn{height:36px;padding:0 15px;border:none !important;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:7px;',
            '  cursor:pointer;font-size:13px;font-weight:650;outline:none !important;box-shadow:none !important;background-image:none !important;filter:none !important;',
            '  transition:none;}',
            '.bingsu-rename-btn-secondary{background:var(--odlg-inset, #ffffff) !important;color:var(--odlg-fg, #212121);}',
            '.bingsu-rename-btn-secondary:hover,.bingsu-rename-btn-secondary:focus,.bingsu-rename-btn-secondary:active{background:var(--odlg-inset, #ffffff) !important;border:none !important;box-shadow:none !important;outline:none !important;filter:none !important;}',
            '.bingsu-rename-btn-secondary.is-active{background:var(--odlg-accent, #0077C8) !important;color:#fff;}',
            '.bingsu-rename-btn-primary{background:var(--odlg-accent, #0077C8) !important;color:#fff;}',
            '.bingsu-rename-btn-primary:hover,.bingsu-rename-btn-primary:focus,.bingsu-rename-btn-primary:active{background:var(--odlg-accent, #0077C8) !important;border:none !important;box-shadow:none !important;outline:none !important;filter:none !important;}',
            '.bingsu-rename-btn:not(:disabled):hover{opacity:1;}',
            '.bingsu-rename-btn:not(:disabled):active{opacity:1;}',
            '.bingsu-rename-btn:disabled{opacity:0.42;cursor:not-allowed;filter:none !important;}',
            '.bingsu-rename-btn-primary:disabled{color:rgba(255,255,255,0.82) !important;-webkit-text-fill-color:rgba(255,255,255,0.82);}',
            '.bingsu-rename-btn:disabled:hover{filter:none !important;}'
        ].join('');
        document.head.appendChild(style);
    }

    function warmDialogSurface() {
        if (document.getElementById('bingsu-rename-warmup')) return;
        var warmup = document.createElement('div');
        warmup.id = 'bingsu-rename-warmup';
        warmup.setAttribute('aria-hidden', 'true');
        warmup.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:460px;height:240px;visibility:hidden;pointer-events:none;contain:layout paint style;overflow:hidden;';

        var modal = document.createElement('div');
        modal.className = 'bingsu-rename-modal';
        var input = document.createElement('input');
        input.className = 'bingsu-rename-input';
        var footer = document.createElement('div');
        footer.className = 'bingsu-rename-footer';
        var secondary = document.createElement('span');
        secondary.className = 'bingsu-rename-btn bingsu-rename-btn-secondary';
        secondary.textContent = T('cancel', 'Cancel');
        var primary = document.createElement('span');
        primary.className = 'bingsu-rename-btn bingsu-rename-btn-primary';
        primary.textContent = T('save', 'Save');
        footer.appendChild(secondary);
        footer.appendChild(primary);
        modal.appendChild(input);
        modal.appendChild(footer);
        warmup.appendChild(modal);
        (document.body || document.documentElement).appendChild(warmup);
        warmup.getBoundingClientRect();
    }

    ensureStyles();
    state.preloadedIcons = preloadCommonIcons();
    warmDialogSurface();

    function close(skipUiClose) {
        var backdrop = document.getElementById('bingsu-rename-backdrop');
        runCleanup();
        if (backdrop) backdrop.remove();

        if (window.BingsuEngine && typeof BingsuEngine.clearDialogFocus === 'function') {
            BingsuEngine.clearDialogFocus();
        } else {
            document.querySelectorAll('tr.deck.ctx-row-active').forEach(function (row) {
                row.classList.remove('ctx-row-active');
            });
            document.body.classList.remove('dialog-focus');
        }

        state.deckId = null;
        state.leafName = '';
        state.fullName = '';
        state.parentPrefix = '';
        state.fullPath = false;

        if (!skipUiClose && backdrop && typeof pycmd === 'function') {
            pycmd('bingsu_ui_close');
        }
    }

    function revealWhenStable(backdrop, focusTarget) {
        if (!backdrop) return;
        backdrop.getBoundingClientRect();
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                backdrop.classList.remove('is-preparing');
                if (!focusTarget) return;
                try {
                    focusTarget.focus({ preventScroll: true });
                } catch (_) {
                    focusTarget.focus();
                }
                focusTarget.select();
            });
        });
    }

    function setError(message) {
        var error = document.getElementById('bingsu-rename-error');
        if (!error) return;
        if (!message) {
            error.style.display = 'none';
            error.textContent = '';
            return;
        }
        error.textContent = message;
        error.style.display = 'block';
    }

    function updateConfirmState() {
        var input = document.getElementById('bingsu-rename-input');
        var saveBtn = document.getElementById('bingsu-rename-save');
        if (saveBtn) saveBtn.disabled = !input || !input.value.trim();
    }

    function updatePathMode() {
        var input = document.getElementById('bingsu-rename-input');
        var toggle = document.getElementById('bingsu-rename-path-toggle');
        var hint = document.getElementById('bingsu-rename-hint');
        if (!input || !toggle || !hint) return;

        if (state.fullPath) {
            input.value = state.fullName || state.leafName || '';
            toggle.textContent = T('rename_leaf_name', 'Leaf name');
            toggle.classList.add('is-active');
            hint.textContent = T('rename_editing_full_path', 'Editing the full deck path');
        } else {
            var current = input.value || state.leafName || '';
            input.value = current.indexOf('::') === -1 ? current : current.split('::').pop();
            toggle.textContent = T('rename_full_path', 'Full path');
            toggle.classList.remove('is-active');
            hint.textContent = state.parentPrefix ? ('Inside ' + state.parentPrefix) : 'Top-level deck';
        }
        setError('');
        updateConfirmState();
        try {
            input.focus({ preventScroll: true });
        } catch (_) {
            input.focus();
        }
        input.select();
    }

    function submit() {
        var input = document.getElementById('bingsu-rename-input');
        if (!input) return;
        var name = input.value.trim();
        if (!name) {
            setError('Enter a deck name.');
            updateConfirmState();
            return;
        }
        var payload = {
            deckId: state.deckId,
            name: name,
            fullPath: !!state.fullPath
        };
        if (typeof pycmd === 'function') {
            pycmd('bingsu_rename_deck:' + encodeURIComponent(JSON.stringify(payload)));
        }
    }

    function buildDialog(data) {
        ensureStyles();
        if (window.BingsuEngine && typeof BingsuEngine.preloadMaskIcons === 'function') {
            BingsuEngine.preloadMaskIcons([iconUrl('rename.svg'), iconUrl('cancel.svg')]);
        }

        state.deckId = data.deckId;
        state.leafName = data.leafName || '';
        state.fullName = data.fullName || state.leafName || '';
        state.parentPrefix = data.parentPrefix || '';
        state.fullPath = false;
        state.cleanupFns = [];

        var backdrop = document.createElement('div');
        backdrop.id = 'bingsu-rename-backdrop';
        backdrop.className = 'is-preparing';

        var modal = document.createElement('div');
        modal.className = 'bingsu-rename-modal';
        modal.addEventListener('click', function (evt) { evt.stopPropagation(); });
        modal.addEventListener('pointerdown', function (evt) { evt.stopPropagation(); });

        var header = document.createElement('div');
        header.className = 'bingsu-rename-header';
        var headerIcon = document.createElement('div');
        headerIcon.className = 'bingsu-rename-header-icon';
        headerIcon.appendChild(makeIcon('rename.svg', 'bingsu-rename-header-svg', 18));
        header.appendChild(headerIcon);

        var titleWrap = document.createElement('div');
        titleWrap.className = 'bingsu-rename-title-wrap';
        var title = document.createElement('div');
        title.className = 'bingsu-rename-title';
        title.textContent = T('rename_deck_title', 'Rename Deck');
        titleWrap.appendChild(title);
        var subtitle = document.createElement('div');
        subtitle.className = 'bingsu-rename-subtitle';
        subtitle.title = state.fullName;
        subtitle.textContent = state.fullName || 'Selected deck';
        titleWrap.appendChild(subtitle);
        header.appendChild(titleWrap);

        var closeBtn = document.createElement('span');
        closeBtn.setAttribute('role', 'button');
        closeBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        closeBtn.className = 'bingsu-rename-close';
        closeBtn.title = T('close', 'Close');
        closeBtn.appendChild(makeIcon('cancel.svg', 'bingsu-rename-close-svg', 14));
        closeBtn.addEventListener('click', function () { close(false); });
        header.appendChild(closeBtn);
        modal.appendChild(header);

        var body = document.createElement('div');
        body.className = 'bingsu-rename-body';
        var label = document.createElement('div');
        label.className = 'bingsu-rename-label';
        label.textContent = T('deck_name_label', 'Deck name');
        body.appendChild(label);

        var inputWrap = document.createElement('div');
        inputWrap.className = 'bingsu-rename-input-wrap';
        var input = document.createElement('input');
        input.id = 'bingsu-rename-input';
        input.className = 'bingsu-rename-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.value = state.leafName;
        input.addEventListener('input', function () {
            setError('');
            updateConfirmState();
        });
        input.addEventListener('keydown', function (evt) {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                submit();
            }
        });
        inputWrap.appendChild(input);
        body.appendChild(inputWrap);

        var hint = document.createElement('div');
        hint.id = 'bingsu-rename-hint';
        hint.className = 'bingsu-rename-hint';
        body.appendChild(hint);
        modal.appendChild(body);

        var error = document.createElement('div');
        error.id = 'bingsu-rename-error';
        error.className = 'bingsu-rename-error';
        modal.appendChild(error);

        var footer = document.createElement('div');
        footer.className = 'bingsu-rename-footer';
        var pathToggle = document.createElement('span');
        pathToggle.setAttribute('role', 'button');
        pathToggle.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        pathToggle.id = 'bingsu-rename-path-toggle';
        pathToggle.className = 'bingsu-rename-btn bingsu-rename-btn-secondary';
        pathToggle.addEventListener('click', function () {
            state.fullPath = !state.fullPath;
            updatePathMode();
        });
        var spacer = document.createElement('div');
        spacer.className = 'bingsu-rename-spacer';
        var cancelBtn = document.createElement('span');
        cancelBtn.setAttribute('role', 'button');
        cancelBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        cancelBtn.className = 'bingsu-rename-btn bingsu-rename-btn-secondary';
        cancelBtn.textContent = T('cancel', 'Cancel');
        cancelBtn.addEventListener('click', function () { close(false); });
        var saveBtn = document.createElement('span');
        saveBtn.setAttribute('role', 'button');
        saveBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        saveBtn.id = 'bingsu-rename-save';
        saveBtn.className = 'bingsu-rename-btn bingsu-rename-btn-primary';
        saveBtn.textContent = T('save', 'Save');
        saveBtn.addEventListener('click', submit);

        footer.appendChild(pathToggle);
        footer.appendChild(spacer);
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        modal.appendChild(footer);

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        backdrop.addEventListener('pointerdown', function (evt) {
            if (evt.target === backdrop) close(false);
        });

        var keyHandler = function (evt) {
            if (evt.key === 'Escape') {
                evt.preventDefault();
                evt.stopPropagation();
                close(false);
            }
        };
        document.addEventListener('keydown', keyHandler, true);
        addCleanup(function () {
            document.removeEventListener('keydown', keyHandler, true);
        });

        updatePathMode();
        revealWhenStable(backdrop, input);
    }

    window.BingsuRenameDialog = {
        open: function (data) {
            close(true);
            if (window.BingsuEngine) {
                BingsuEngine._clearAllRowVisualStates();
                BingsuEngine._beginOverrideState('dialog-focus');
                var deckId = String(data && data.deckId || '');
                var selectorId = typeof BingsuEngine.escapeSelectorValue === 'function'
                    ? BingsuEngine.escapeSelectorValue(deckId)
                    : deckId.replace(/["\\]/g, '\\$&');
                var row = document.querySelector('tr.deck[data-did="' + selectorId + '"]');
                if (row) row.classList.add('ctx-row-active');
            }
            buildDialog(data || {});
            if (typeof pycmd === 'function') pycmd('bingsu_ui_open');
        },
        close: close,
        showError: setError
    };
})();
