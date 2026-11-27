(function () {
    if (window.BingsuCreateDeckDialog) return;

    var state = {
        destinations: [],
        selectedId: null,
        cleanupFns: [],
        preloadedIcons: [],
        rowById: {},
        busy: false
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
        var urls = ['create_deck.svg', 'cancel.svg', 'search.svg', 'deck.svg', 'subdeck.svg', 'folder.svg', 'filtered_deck.svg']
            .map(iconUrl)
            .filter(Boolean);
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
        if (document.getElementById('bingsu-create-deck-style')) return;

        var style = document.createElement('style');
        style.id = 'bingsu-create-deck-style';
        style.textContent = [
            '#bingsu-create-deck-backdrop{position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;',
            '  background:var(--odlg-scrim,rgba(0,0,0,0.58));contain:layout paint style;isolation:isolate;transform:translateZ(0);',
            '  backface-visibility:hidden;-webkit-backface-visibility:hidden;}',
            '#bingsu-create-deck-backdrop.is-preparing{visibility:hidden;}',
            '#bingsu-create-deck-backdrop *{box-sizing:border-box;}',
            '#bingsu-create-deck-backdrop button,#bingsu-create-deck-backdrop input{appearance:none;-webkit-appearance:none;',
            '  font-family:var(--font-main,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif);}',
            '#bingsu-create-deck-backdrop button{border:none !important;outline:none !important;box-shadow:none !important;background-image:none !important;}',
            '.bingsu-create-deck-modal{width:540px;max-width:94vw;height:520px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;',
            '  border-radius:18px;border:1px solid var(--odlg-border,rgba(0,0,0,0.14));',
            '  background:var(--odlg-surface,#ffffff);color:var(--odlg-fg,#212121);',
            '  box-shadow:0 24px 70px rgba(0,0,0,0.42);',
            '  backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translateZ(0);contain:layout paint style;isolation:isolate;}',
            '.bingsu-create-deck-header{display:flex;align-items:flex-start;gap:12px;padding:18px 18px 14px;}',
            '.bingsu-create-deck-header-icon{width:22px;height:22px;min-width:22px;margin-top:1px;display:flex;align-items:center;justify-content:center;',
            '  color:var(--odlg-accent,#0077C8);}',
            '.bingsu-create-deck-title-wrap{min-width:0;flex:1;}',
            '.bingsu-create-deck-title{font-size:16px;font-weight:700;line-height:1.2;margin:0 0 5px;color:var(--odlg-fg,#212121);}',
            '.bingsu-create-deck-subtitle{font-size:13px;color:var(--odlg-fg-subtle,#757575);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.bingsu-create-deck-close{width:30px;height:30px;min-width:30px;padding:0;border:none !important;border-radius:8px;background:transparent !important;color:var(--odlg-fg-subtle,#757575);',
            '  display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none !important;box-shadow:none !important;filter:none !important;',
            '  opacity:1;transition:none;}',
            '.bingsu-create-deck-close:hover,.bingsu-create-deck-close:focus,.bingsu-create-deck-close:active{background:transparent !important;color:var(--odlg-fg-subtle,#757575);opacity:1;box-shadow:none !important;border:none !important;filter:none !important;}',
            '.bingsu-create-deck-name-wrap{margin:14px 18px 10px;}',
            '.bingsu-create-deck-label{font-size:11px;font-weight:700;color:var(--odlg-fg-subtle,#757575);margin:0 0 8px;text-transform:uppercase;}',
            '.bingsu-create-deck-input-wrap{position:relative;}',
            '.bingsu-create-deck-input{width:100%;height:38px;padding:0 13px;border-radius:10px;border:1px solid transparent;',
            '  background:var(--odlg-highlight,rgba(0,0,0,0.05));color:var(--odlg-fg,#212121);font-size:13px;outline:none;box-shadow:none;',
            '  transition:none;}',
            '.bingsu-create-deck-input::placeholder{color:var(--odlg-fg-subtle,#757575);}',
            '.bingsu-create-deck-input:hover{background:var(--odlg-highlight,rgba(0,0,0,0.05));}',
            '.bingsu-create-deck-input:focus{border-color:var(--odlg-accent,#0077C8);}',
            '.bingsu-create-deck-parent-label{font-size:11px;font-weight:700;color:var(--odlg-fg-subtle,#757575);margin:0 18px 8px;text-transform:uppercase;}',
            '.bingsu-create-deck-search-wrap{position:relative;margin:0 18px 10px;flex-shrink:0;}',
            '.bingsu-create-deck-search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--odlg-fg-subtle,#757575);pointer-events:none;}',
            '.bingsu-create-deck-search{width:100%;height:36px;padding:0 13px 0 36px;border-radius:10px;border:1px solid transparent;',
            '  background:var(--odlg-highlight,rgba(0,0,0,0.05));color:var(--odlg-fg,#212121);font-size:13px;outline:none;box-shadow:none;',
            '  transition:none;}',
            '.bingsu-create-deck-search::placeholder{color:var(--odlg-fg-subtle,#757575);}',
            '.bingsu-create-deck-search:hover{background:var(--odlg-highlight,rgba(0,0,0,0.05));}',
            '.bingsu-create-deck-search:focus{border-color:var(--odlg-accent,#0077C8);}',
            '.bingsu-create-deck-list{flex:1;min-height:0;margin:0 12px 6px;padding:2px 6px;overflow:auto;border:none;background:transparent;position:relative;',
            '  contain:layout paint style;isolation:isolate;}',
            '.bingsu-create-deck-row{width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;border:none;',
            '  color:var(--odlg-fg,#212121);cursor:pointer;user-select:none;background:transparent;position:relative;transition:none;}',
            '.bingsu-create-deck-row + .bingsu-create-deck-row{margin-top:2px;}',
            '.bingsu-create-deck-row:hover{background:var(--odlg-highlight,rgba(0,0,0,0.05));}',
            '.bingsu-create-deck-row.is-selected{background:color-mix(in srgb, var(--odlg-accent,#0077C8) 14%, transparent);}',
            '.bingsu-create-deck-row.is-selected .bingsu-create-deck-row-name{font-weight:700;}',
            '.bingsu-create-deck-row.is-selected .bingsu-create-deck-row-icon{color:var(--odlg-accent,#0077C8);}',
            '.bingsu-create-deck-row.is-hidden{display:none;}',
            '.bingsu-create-deck-row-icon{width:18px;height:18px;min-width:18px;display:flex;align-items:center;justify-content:center;',
            '  color:var(--odlg-fg-subtle,#757575);background:transparent;}',
            '.bingsu-create-deck-row-text{min-width:0;flex:1;}',
            '.bingsu-create-deck-row-name{font-size:13px;font-weight:600;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.bingsu-create-deck-row-path{font-size:11px;color:var(--odlg-fg-subtle,#757575);line-height:1.25;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.bingsu-create-deck-empty{height:100%;min-height:160px;display:none;align-items:center;justify-content:center;text-align:center;',
            '  color:var(--odlg-fg-subtle,#757575);font-size:13px;padding:20px;}',
            '.bingsu-create-deck-error{display:none;margin:0 18px 10px;padding:9px 11px;border-radius:9px;background:rgba(192,48,48,0.12);',
            '  color:#d84a4a;font-size:12px;line-height:1.35;}',
            '.bingsu-create-deck-footer{display:flex;align-items:center;gap:8px;padding:10px 18px 16px;}',
            '.bingsu-create-deck-spacer{flex:1;}',
            '.bingsu-create-deck-btn{height:34px;min-width:88px;padding:0 15px;border:none !important;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:7px;',
            '  cursor:pointer;font-size:13px;font-weight:600;outline:none !important;box-shadow:none !important;background-image:none !important;',
            '  filter:none !important;transition:none;}',
            '.bingsu-create-deck-btn-secondary{background:var(--odlg-highlight,rgba(0,0,0,0.05)) !important;color:var(--odlg-fg,#212121);}',
            '.bingsu-create-deck-btn-secondary:hover,.bingsu-create-deck-btn-secondary:focus,.bingsu-create-deck-btn-secondary:active{background:var(--odlg-highlight,rgba(0,0,0,0.05)) !important;border:none !important;box-shadow:none !important;outline:none !important;}',
            '.bingsu-create-deck-btn-primary{background:var(--odlg-accent,#0077C8) !important;color:#fff;}',
            '.bingsu-create-deck-btn-primary:hover,.bingsu-create-deck-btn-primary:focus,.bingsu-create-deck-btn-primary:active{background:var(--odlg-accent,#0077C8) !important;border:none !important;box-shadow:none !important;outline:none !important;filter:none !important;}',
            '.bingsu-create-deck-btn:not(:disabled):hover{opacity:1;}',
            '.bingsu-create-deck-btn:not(:disabled):active{opacity:1;}',
            '.bingsu-create-deck-btn:disabled{opacity:0.42;cursor:not-allowed;filter:none !important;}',
            '.bingsu-create-deck-btn-primary:disabled{color:rgba(255,255,255,0.82) !important;-webkit-text-fill-color:rgba(255,255,255,0.82);}',
            '.bingsu-create-deck-btn:disabled:hover{filter:none !important;}',
            '.bingsu-create-deck-list::-webkit-scrollbar{width:10px;background:transparent;}',
            '.bingsu-create-deck-list::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.38);border-radius:999px;border:2px solid transparent;background-clip:content-box;}',
            '.bingsu-create-deck-list::-webkit-scrollbar-track{background:transparent;}'
        ].join('');
        document.head.appendChild(style);
    }

    function warmDialogSurface() {
        if (document.getElementById('bingsu-create-deck-warmup')) return;
        var warmup = document.createElement('div');
        warmup.id = 'bingsu-create-deck-warmup';
        warmup.setAttribute('aria-hidden', 'true');
        warmup.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:540px;height:520px;visibility:hidden;pointer-events:none;contain:layout paint style;overflow:hidden;';

        var modal = document.createElement('div');
        modal.className = 'bingsu-create-deck-modal';
        var search = document.createElement('input');
        search.className = 'bingsu-create-deck-search';
        var list = document.createElement('div');
        list.className = 'bingsu-create-deck-list';
        var row = document.createElement('div');
        row.className = 'bingsu-create-deck-row is-selected';
        list.appendChild(row);
        var footer = document.createElement('div');
        footer.className = 'bingsu-create-deck-footer';
        var secondary = document.createElement('span');
        secondary.className = 'bingsu-create-deck-btn bingsu-create-deck-btn-secondary';
        secondary.textContent = 'Cancel';
        var primary = document.createElement('span');
        primary.className = 'bingsu-create-deck-btn bingsu-create-deck-btn-primary';
        primary.textContent = 'Create';
        footer.appendChild(secondary);
        footer.appendChild(primary);
        modal.appendChild(search);
        modal.appendChild(list);
        modal.appendChild(footer);
        warmup.appendChild(modal);
        (document.body || document.documentElement).appendChild(warmup);
        warmup.getBoundingClientRect();
    }

    ensureStyles();
    state.preloadedIcons = preloadCommonIcons();
    warmDialogSurface();

    function close(skipUiClose) {
        var backdrop = document.getElementById('bingsu-create-deck-backdrop');
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

        state.destinations = [];
        state.selectedId = null;
        state.rowById = {};
        state.preloadedIcons = [];
        state.busy = false;

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
            });
        });
    }

    function destinationMatches(dest, query) {
        if (!query) return true;
        var haystack = [
            dest.name || '',
            dest.path || ''
        ].join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function updateConfirmState() {
        var createBtn = document.getElementById('bingsu-create-deck-create');
        if (!createBtn) return;
        var input = document.getElementById('bingsu-create-deck-input');
        createBtn.disabled = !input || !input.value.trim();
    }

    function selectDestination(destinationId) {
        state.selectedId = destinationId === null || destinationId === undefined
            ? null
            : String(destinationId);

        Object.keys(state.rowById || {}).forEach(function (id) {
            state.rowById[id].classList.toggle('is-selected', id === state.selectedId);
        });

        var err = document.getElementById('bingsu-create-deck-error');
        if (err) err.style.display = 'none';
        updateConfirmState();
    }

    function buildRows() {
        var list = document.getElementById('bingsu-create-deck-list');
        var empty = document.getElementById('bingsu-create-deck-empty');
        if (!list || !empty) return;

        list.innerHTML = '';
        state.rowById = {};

        state.destinations.forEach(function (dest) {
            var row = document.createElement('div');
            row.className = 'bingsu-create-deck-row';
            row.dataset.destinationId = String(dest.id);

            var iconWrap = document.createElement('div');
            iconWrap.className = 'bingsu-create-deck-row-icon';
            iconWrap.appendChild(makeIcon(dest.iconUrl || (dest.kind === 'root' ? 'folder.svg' : 'deck.svg'), 'bingsu-create-deck-row-svg', 15, 'currentColor'));
            row.appendChild(iconWrap);

            var text = document.createElement('div');
            text.className = 'bingsu-create-deck-row-text';
            var name = document.createElement('div');
            name.className = 'bingsu-create-deck-row-name';
            name.textContent = dest.name || dest.path || 'Untitled deck';
            text.appendChild(name);

            var path = document.createElement('div');
            path.className = 'bingsu-create-deck-row-path';
            path.textContent = dest.kind === 'root' ? 'Create as a top-level deck' : (dest.path || dest.name || '');
            text.appendChild(path);
            row.appendChild(text);

            row.addEventListener('click', function () {
                selectDestination(dest.id);
            });

            state.rowById[String(dest.id)] = row;
            list.appendChild(row);
        });

        list.appendChild(empty);
        applyFilter();
    }

    function applyFilter() {
        var empty = document.getElementById('bingsu-create-deck-empty');
        var search = document.getElementById('bingsu-create-deck-search');
        var query = search ? search.value.trim().toLowerCase() : '';
        var visibleCount = 0;
        var selectedVisible = false;

        state.destinations.forEach(function (dest) {
            var row = state.rowById && state.rowById[String(dest.id)];
            if (!row) return;
            var visible = !query || destinationMatches(dest, query);
            row.classList.toggle('is-hidden', !visible);
            if (!visible) return;
            visibleCount += 1;
            if (String(dest.id) === String(state.selectedId)) selectedVisible = true;
        });

        if (state.selectedId !== null && !selectedVisible) {
            selectDestination(null);
        } else {
            updateConfirmState();
        }

        if (empty) empty.style.display = visibleCount ? 'none' : 'flex';
    }

    function showError(message) {
        state.busy = false;
        var error = document.getElementById('bingsu-create-deck-error');
        if (error) {
            error.textContent = message || 'Could not create deck.';
            error.style.display = 'block';
        }
        updateConfirmState();
    }

    function clearError() {
        state.busy = false;
        var error = document.getElementById('bingsu-create-deck-error');
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
        }
        updateConfirmState();
    }

    function submit() {
        if (state.busy) return;
        var input = document.getElementById('bingsu-create-deck-input');
        if (!input) return;
        var name = input.value.trim();
        if (!name) {
            showError('Enter a deck name.');
            return;
        }
        state.busy = true;
        updateConfirmState();
        var payload = {
            name: name,
            parentDid: state.selectedId
        };
        if (typeof pycmd === 'function') {
            pycmd('bingsu_create_deck_submit:' + encodeURIComponent(JSON.stringify(payload)));
        }
    }

    function buildModal(data) {
        state.destinations = Array.isArray(data.destinations) ? data.destinations : [];
        state.selectedId = state.destinations.length ? String(state.destinations[0].id) : null;
        state.cleanupFns = [];
        state.busy = false;

        var backdrop = document.createElement('div');
        backdrop.id = 'bingsu-create-deck-backdrop';
        backdrop.className = 'is-preparing';

        var modal = document.createElement('div');
        modal.className = 'bingsu-create-deck-modal';
        modal.addEventListener('click', function (evt) { evt.stopPropagation(); });
        modal.addEventListener('pointerdown', function (evt) { evt.stopPropagation(); });

        var header = document.createElement('div');
        header.className = 'bingsu-create-deck-header';

        var headerIcon = document.createElement('div');
        headerIcon.className = 'bingsu-create-deck-header-icon';
        headerIcon.appendChild(makeIcon('create_deck.svg', 'bingsu-create-deck-header-svg', 18, 'currentColor'));
        header.appendChild(headerIcon);

        var titleWrap = document.createElement('div');
        titleWrap.className = 'bingsu-create-deck-title-wrap';
        var title = document.createElement('div');
        title.className = 'bingsu-create-deck-title';
        title.textContent = T('create_deck_title', 'Create New Deck');
        titleWrap.appendChild(title);

        var subtitle = document.createElement('div');
        subtitle.className = 'bingsu-create-deck-subtitle';
        subtitle.textContent = T('create_deck_subtitle', 'Choose a name and optional parent deck');
        titleWrap.appendChild(subtitle);
        header.appendChild(titleWrap);

        var closeBtn = document.createElement('span');
        closeBtn.setAttribute('role', 'button');
        closeBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        closeBtn.className = 'bingsu-create-deck-close';
        closeBtn.title = T('close', 'Close');
        closeBtn.appendChild(makeIcon('cancel.svg', 'bingsu-create-deck-close-svg', 14, 'currentColor'));
        closeBtn.addEventListener('click', function () { close(false); });
        header.appendChild(closeBtn);
        modal.appendChild(header);

        var nameWrap = document.createElement('div');
        nameWrap.className = 'bingsu-create-deck-name-wrap';
        var nameLabel = document.createElement('div');
        nameLabel.className = 'bingsu-create-deck-label';
        nameLabel.textContent = T('deck_name_label', 'Deck name');
        nameWrap.appendChild(nameLabel);

        var inputWrap = document.createElement('div');
        inputWrap.className = 'bingsu-create-deck-input-wrap';
        var input = document.createElement('input');
        input.id = 'bingsu-create-deck-input';
        input.className = 'bingsu-create-deck-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = T('deck_name_placeholder', 'e.g. Biology');
        input.addEventListener('input', function () {
            clearError();
        });
        input.addEventListener('keydown', function (evt) {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                submit();
            }
        });
        inputWrap.appendChild(input);
        nameWrap.appendChild(inputWrap);
        modal.appendChild(nameWrap);

        var parentLabel = document.createElement('div');
        parentLabel.className = 'bingsu-create-deck-parent-label';
        parentLabel.textContent = T('parent_deck_label', 'Parent deck');
        modal.appendChild(parentLabel);

        var searchWrap = document.createElement('div');
        searchWrap.className = 'bingsu-create-deck-search-wrap';
        searchWrap.appendChild(makeIcon('search.svg', 'bingsu-create-deck-search-icon', 15, 'currentColor'));
        var search = document.createElement('input');
        search.id = 'bingsu-create-deck-search';
        search.className = 'bingsu-create-deck-search';
        search.type = 'text';
        search.placeholder = T('search_decks', 'Search decks');
        search.autocomplete = 'off';
        search.spellcheck = false;
        search.addEventListener('input', applyFilter);
        searchWrap.appendChild(search);
        modal.appendChild(searchWrap);

        var list = document.createElement('div');
        list.id = 'bingsu-create-deck-list';
        list.className = 'bingsu-create-deck-list';
        // Hover/selection are plain CSS states now, so the list needs no pointer
        // bookkeeping or measured highlight layers.
        var empty = document.createElement('div');
        empty.id = 'bingsu-create-deck-empty';
        empty.className = 'bingsu-create-deck-empty';
        empty.textContent = T('no_matching_decks', 'No matching decks found');
        list.appendChild(empty);
        modal.appendChild(list);

        var error = document.createElement('div');
        error.id = 'bingsu-create-deck-error';
        error.className = 'bingsu-create-deck-error';
        modal.appendChild(error);

        var footer = document.createElement('div');
        footer.className = 'bingsu-create-deck-footer';
        var spacer = document.createElement('div');
        spacer.className = 'bingsu-create-deck-spacer';

        var cancelBtn = document.createElement('span');
        cancelBtn.setAttribute('role', 'button');
        cancelBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        cancelBtn.className = 'bingsu-create-deck-btn bingsu-create-deck-btn-secondary';
        cancelBtn.textContent = T('cancel', 'Cancel');
        cancelBtn.addEventListener('click', function () { close(false); });

        var createBtn = document.createElement('span');
        createBtn.setAttribute('role', 'button');
        createBtn.tabIndex = 0;
        // Set tabindex for accessibility
        try { arguments[0].tabIndex = 0; } catch(e){};
        createBtn.id = 'bingsu-create-deck-create';
        createBtn.className = 'bingsu-create-deck-btn bingsu-create-deck-btn-primary';
        createBtn.disabled = true;
        createBtn.textContent = T('create_action', 'Create');
        createBtn.addEventListener('click', submit);

        footer.appendChild(spacer);
        footer.appendChild(cancelBtn);
        footer.appendChild(createBtn);
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

        buildRows();
        revealWhenStable(backdrop, input);
    }

    window.BingsuCreateDeckDialog = {
        open: function (data) {
            close(true);
            if (window.BingsuEngine) {
                BingsuEngine._clearAllRowVisualStates();
                BingsuEngine._beginOverrideState('dialog-focus');
            }
            buildModal(data || {});
            if (typeof pycmd === 'function') pycmd('bingsu_ui_open');
        },
        close: close,
        showError: showError
    };
})();
