window.BingsuIconChooser = (function () {
    const EMOJIS = [
        { value: "🤍", label: "White Heart", asset: "heart_white.svg" },
        { value: "🧼", label: "Soap", asset: "soap.svg" },
        { value: "💀", label: "Skull", asset: "skull.svg" },
        { value: "📄", label: "Paper", asset: "paper.svg" },
        { value: "📝", label: "Memo", asset: "memo.svg" },
        { value: "📖", label: "Open Book", asset: "open_book.svg" },
        { value: "🍙", label: "Onigiri", asset: "onigiri.svg" },
        { value: "🩷", label: "Light Pink Heart", asset: "heart_light_pink.svg" },
        { value: "💕", label: "Two Hearts", asset: "two_hearts.svg" },
        { value: "🌸", label: "Cherry Blossom", asset: "cherry_blossom.svg" },
        { value: "🌷", label: "Tulip", asset: "tulip.svg" },
        { value: "🪷", label: "Lotus", asset: "lotus.svg" },
        { value: "🧠", label: "Brain", asset: "brain.svg" },
        { value: "🦑", label: "Squid", asset: "squid.svg" },
        { value: "❤️", label: "Red Heart", asset: "heart_red.svg" },
        { value: "🫀", label: "Anatomical Heart", asset: "anatomical_heart.svg" },
        { value: "📕", label: "Red Book", asset: "red_book.svg" },
        { value: "🔥", label: "Fire", asset: "fire.svg" },
        { value: "🍉", label: "Watermelon", asset: "watermelon.svg" },
        { value: "🧡", label: "Orange Heart", asset: "heart_orange.svg" },
        { value: "🍊", label: "Tangerine", asset: "tangerine.svg" },
        { value: "🍹", label: "Tropical Drink", asset: "tropical_drink.svg" },
        { value: "🧇", label: "Waffle", asset: "waffle.svg" },
        { value: "🍍", label: "Pineapple", asset: "pineapple.svg" },
        { value: "⭐", label: "Star", asset: "star.svg" },
        { value: "✨", label: "Sparkle", asset: "sparkle.svg" },
        { value: "⚡", label: "Bolt", asset: "bolt.svg" },
        { value: "🏆", label: "Trophy", asset: "trophy.svg" },
        { value: "💛", label: "Yellow Heart", asset: "heart_yellow.svg" },
        { value: "📙", label: "Yellow Book", asset: "yellow_book.svg" },
        { value: "✏️", label: "Pen", asset: "pen.svg" },
        { value: "🍋‍🟩", label: "Lime", asset: "lime.svg" },
        { value: "💚", label: "Green Heart", asset: "heart_green.svg" },
        { value: "📗", label: "Green Book", asset: "green_book.svg" },
        { value: "🌱", label: "Plant", asset: "emoji.svg" },
        { value: "🍀", label: "Four Leaf Clover", asset: "four_leaf_clover.svg" },
        { value: "🍃", label: "Leaf Fluttering In Wind", asset: "leaf_fluttering_in_wind.svg" },
        { value: "🌳", label: "Deciduous Tree", asset: "deciduous_tree.svg" },
        { value: "🌲", label: "Evergreen Tree", asset: "evergreen_tree.svg" },
        { value: "🎄", label: "Christmas Tree", asset: "christmas_tree.svg" },
        { value: "🍵", label: "Teacup", asset: "teacup_without_handle.svg" },
        { value: "💙", label: "Blue Heart", asset: "blue_heart.svg" },
        { value: "📘", label: "Blue Book", asset: "blue_book.svg" },
        { value: "💧", label: "Droplet", asset: "droplet.svg" },
        { value: "💎", label: "Gem Stone", asset: "gem_stone.svg" },
        { value: "🧪", label: "Test Tube", asset: "test_tube.svg" },
        { value: "🍇", label: "Grapes", asset: "grapes.svg" },
        { value: "🔬", label: "Microscope", asset: "microscope.svg" },
        { value: "💻", label: "Computer", asset: "computer.svg" },
        { value: "📟", label: "Pager", asset: "pager.svg" },
        { value: "🎮", label: "Videogame", asset: "videogame.svg" },
        { value: "🍡", label: "Dango", asset: "dango.svg" },
        { value: "📚", label: "Books", asset: "books.svg" },
        { value: "🗺️", label: "World Map", asset: "world_map.svg" },
    ];

    // Empty color means "follow the theme", i.e. the icon is painted with
    // --icon-color like every other deck icon SVG. Python stores it as "".
    const THEME_COLOR = "";

    const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';

    const state = {
        deckId: "",
        selectedIcon: "",
        selectedColorLight: THEME_COLOR,
        selectedColorDark: THEME_COLOR,
        emojiBaseUrl: "/_addons/1011095603/system_files/emojis",
        data: {},
    };

    function T(key, fallback) {
        if (window.BingsuI18n && typeof BingsuI18n.t === 'function') {
            return BingsuI18n.t(key, fallback);
        }
        return fallback;
    }

    function isNightMode() {
        const forced = document.documentElement.dataset.rfTheme;
        if (forced === "dark") return true;
        if (forced === "light") return false;
        return document.documentElement.classList.contains("night-mode")
            || document.documentElement.classList.contains("nightMode")
            || document.body.classList.contains("night-mode")
            || document.body.classList.contains("nightMode")
            || (window.matchMedia
                && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    // The colour the grid preview and the modal's own tinted mask actually
    // paint with right now — whichever slot matches the page's live theme.
    function activeColor() {
        return isNightMode() ? state.selectedColorDark : state.selectedColorLight;
    }

    function py(command) {
        if (typeof pycmd === "function") pycmd(command);
    }

    function close() {
        const backdrop = document.getElementById("bingsu-icon-backdrop");
        if (backdrop) backdrop.remove();
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
            '  --odlg-accent:var(--rf-accent,var(--accent-color,#0077C8));--odlg-scrim:rgba(0,0,0,0.45);}',
            '.night-mode,.nightMode,:root[data-rf-theme="dark"]{--odlg-surface:#242424;--odlg-inset:#242424;',
            '  --odlg-fg:#f4f4f5;--odlg-fg-subtle:#c4c4c4;',
            '  --odlg-border:#454545;--odlg-highlight:#303030;--odlg-hover:#3a3a3a;',
            '  --odlg-accent:var(--rf-accent,var(--accent-color,#0077C8));--odlg-scrim:rgba(0,0,0,0.62);}',
            ':root[data-rf-theme="light"],:root[data-rf-theme="light"] body{--odlg-surface:#ffffff;--odlg-inset:#ffffff;',
            '  --odlg-fg:#202124;--odlg-fg-subtle:#6f7177;',
            '  --odlg-border:#dcdde1;--odlg-highlight:#f2f2f2;--odlg-hover:#e9e9e9;',
            '  --odlg-accent:var(--rf-accent,var(--accent-color,#0077C8));--odlg-scrim:rgba(0,0,0,0.45);}'
        ].join('');
        (document.head || document.documentElement).appendChild(tokenStyle);
    }

    function ensureStyles() {
        ensureDialogThemeTokens();
        if (document.getElementById("bingsu-icon-modal-styles")) return;
        const style = document.createElement("style");
        style.id = "bingsu-icon-modal-styles";
        style.textContent = `
            /* Picker tokens. These mirror ui_kit/picker_chrome.py one for one
               so the Qt pickers and this modal read as the same dialog. */
            #bingsu-icon-backdrop {
                --pk-surface: #ffffff;
                --pk-fg: #202124;
                --pk-muted: #8f9299;
                --pk-inset: #f2f2f2;
                --pk-inset-hover: #e9e9e9;
                --pk-hairline: #dcdde1;
                --pk-surface-alt: #fbfbfa;
                --pk-accent: var(--odlg-accent, #0077C8);
                position: fixed;
                inset: 0;
                z-index: 200000;
                display: flex;
                align-items: center;
                justify-content: center;
                /* One composited layer blurs the whole page behind the modal —
                   cheaper than filtering the page content itself. */
                background: rgba(0, 0, 0, 0.24);
                backdrop-filter: blur(14px) saturate(120%);
                -webkit-backdrop-filter: blur(14px) saturate(120%);
            }
            .night-mode #bingsu-icon-backdrop,
            .nightMode #bingsu-icon-backdrop {
                --pk-surface: #242424;
                --pk-fg: #f4f4f5;
                --pk-muted: #8a8a8a;
                --pk-inset: #303030;
                --pk-inset-hover: #3a3a3a;
                --pk-hairline: #454545;
                --pk-surface-alt: #2a2a2a;
                background: rgba(0, 0, 0, 0.38);
            }
            #bingsu-icon-backdrop button,
            #bingsu-icon-backdrop input {
                -webkit-appearance: none !important;
                appearance: none !important;
                box-sizing: border-box !important;
                font-family: inherit !important;
                line-height: 1 !important;
                margin: 0 !important;
                outline: none !important;
                transform: none !important;
                letter-spacing: 0 !important;
            }
            #bingsu-icon-backdrop button:hover,
            #bingsu-icon-backdrop button:active,
            #bingsu-icon-backdrop button:focus {
                transform: none !important;
                box-shadow: none !important;
            }
            .bingsu-icon-modal {
                position: relative;
                width: min(540px, 94vw);
                height: min(660px, 90vh);
                display: flex;
                flex-direction: column;
                border: 1px solid var(--pk-hairline);
                border-radius: 20px;
                background: var(--pk-surface);
                color: var(--pk-fg);
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
                overflow: hidden;
                contain: layout paint;
            }
            .bingsu-icon-modal-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 18px 20px;
                flex-shrink: 0;
                border-bottom: 1px solid var(--pk-hairline);
                background: var(--pk-inset);
            }
            .bingsu-icon-modal-footer {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px 18px;
                flex-shrink: 0;
                justify-content: center;
            }
            .bingsu-icon-modal-title {
                font-size: 15.5px;
                font-weight: 600;
                flex: 1 1 auto;
            }
            .bingsu-icon-modal-close {
                width: 28px;
                height: 28px;
                min-width: 28px !important;
                max-width: 28px !important;
                padding: 0 !important;
                border: 1px solid transparent !important;
                border-radius: 10px !important;
                background: transparent !important;
                color: var(--pk-muted) !important;
                cursor: pointer;
                flex: 0 0 auto;
            }
            .bingsu-icon-modal-close:hover {
                background: var(--pk-inset) !important;
                color: var(--pk-fg) !important;
            }
            .bingsu-icon-modal-close svg {
                display: block;
                width: 15px;
                height: 15px;
                margin: auto;
                pointer-events: none;
            }
            /* Segmented switch: one inset track, the active segment lifted onto
               the modal's own surface. */
            .bingsu-icon-tabs {
                display: flex;
                gap: 2px;
                margin: 14px 20px 0;
                padding: 3px;
                border-radius: 12px;
                background: var(--pk-inset);
                flex-shrink: 0;
            }
            .bingsu-icon-tab {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 1 1 0 !important;
                height: 30px !important;
                padding: 0 14px !important;
                border: 1px solid transparent !important;
                border-radius: 9px !important;
                background: transparent !important;
                color: var(--pk-muted) !important;
                cursor: pointer;
                font-size: 12.5px !important;
                font-weight: 600 !important;
            }
            .bingsu-icon-tab:hover {
                color: var(--pk-fg) !important;
            }
            .bingsu-icon-tab.active {
                background: var(--pk-surface) !important;
                color: var(--pk-fg) !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            }
            .bingsu-icon-body {
                flex: 1;
                min-height: 0;
                display: flex;
                flex-direction: column;
                padding: 14px 20px 6px;
                overflow: hidden;
            }
            .bingsu-icon-pane {
                flex: 1;
                min-height: 0;
                display: none;
                flex-direction: column;
                overflow: hidden;
            }
            .bingsu-icon-pane.active {
                display: flex;
            }
            .bingsu-icon-search-row {
                flex: 0 0 auto;
                padding: 0 0 12px;
            }
            .bingsu-icon-search {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid transparent;
                border-radius: 10px;
                background: var(--pk-inset);
                color: var(--pk-fg);
                padding: 9px 12px;
                margin-bottom: 0;
                outline: none;
            }
            .bingsu-icon-search:focus {
                border-color: var(--pk-accent);
            }
            /* No panel behind the grid any more — each tile floats directly
               on the modal's own surface, so there is nothing here left to
               round or clip (see the corner-rounding saga this class used
               to carry in history). */
            .bingsu-icon-grid-wrap {
                flex: 1;
                min-height: 0;
                overflow: hidden;
                display: flex;
            }
            .bingsu-icon-grid {
                flex: 1;
                min-height: 0;
                min-width: 0;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
                align-content: start;
                gap: 8px;
                overflow-x: hidden;
                overflow-y: auto;
                padding: 10px;
                scrollbar-width: thin;
            }
            .bingsu-icon-grid::-webkit-scrollbar { width: 8px; }
            .bingsu-icon-grid::-webkit-scrollbar-thumb {
                background: var(--pk-muted);
                border-radius: 8px;
                background-clip: content-box;
                border: 2px solid transparent;
            }
            /* Bleeds a slice of the modal's own surface over the panel behind
               the label, and sticks so a section's title stays put while its
               own tiles scroll under it. */
            .bingsu-icon-section-title {
                grid-column: 1 / -1;
                color: var(--pk-muted);
                font-size: 10.5px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                background: var(--pk-surface);
                margin: 0 -10px;
                padding: 8px 10px 4px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            /* Idle cells carry no outline — only the selected one does. No
               transitions here either: the grid can hold hundreds of cells. */
            .bingsu-icon-cell {
                position: relative;
                height: 44px;
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                border: 1px solid transparent;
                border-radius: 10px;
                /* Same fill as the search field right above the grid — one
                   flat colour for every "sunken" control in this modal, not
                   a separate panel tone just for tiles. */
                background: var(--pk-inset);
                cursor: pointer;
            }
            .bingsu-icon-cell:hover {
                background: var(--pk-inset-hover);
            }
            .bingsu-icon-cell.selected {
                border-color: var(--pk-accent);
                background: var(--pk-inset-hover); /* fallback for older WebEngine */
                background: color-mix(in srgb, var(--pk-accent) 16%, transparent);
            }
            /* --icon-color is declared on :root (light) and .night-mode (dark),
               so it can only be read from inside the modal — resolving it on
               documentElement would always pick the light value. */
            .bingsu-icon-modal.theme-icon-color .bingsu-icon-mask {
                background: var(--icon-color, #888888);
            }
            .bingsu-icon-mask {
                width: 20px;
                height: 20px;
                background: var(--bingsu-selected-icon-color, #888888);
                mask-size: contain;
                -webkit-mask-size: contain;
                mask-repeat: no-repeat;
                -webkit-mask-repeat: no-repeat;
                mask-position: center;
                -webkit-mask-position: center;
            }
            .bingsu-icon-image {
                width: 24px;
                height: 24px;
                object-fit: contain;
            }
            .bingsu-icon-emoji {
                font-size: 20px;
                line-height: 1;
            }
            .bingsu-icon-emoji-img {
                width: 26px;
                height: 26px;
                max-width: 26px;
                max-height: 26px;
                aspect-ratio: 1 / 1;
                object-fit: contain;
                pointer-events: none;
            }
            .bingsu-icon-custom-emoji {
                grid-column: 1 / -1;
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 48px;
                padding: 10px;
                border: 1px solid transparent;
                border-radius: 14px;
                background: var(--pk-inset);
            }
            .bingsu-icon-custom-emoji button {
                height: 32px !important;
                min-width: 118px !important;
                padding: 0 12px !important;
                border: none !important;
                border-radius: 10px !important;
                background: var(--pk-inset-hover) !important;
                color: var(--pk-fg) !important;
                cursor: pointer;
                font-size: 13px !important;
                font-weight: 600 !important;
            }
            .bingsu-icon-custom-emoji input {
                flex: 1;
                min-width: 80px;
                height: 32px;
                border: 1px solid transparent;
                border-radius: 10px;
                background: var(--pk-surface);
                color: var(--pk-fg);
                padding: 0 10px;
                font-size: 18px;
            }
            .bingsu-icon-custom-emoji input:focus {
                border-color: var(--pk-accent);
            }
            .bingsu-icon-delete {
                position: absolute;
                top: 2px;
                right: 2px;
                width: 14px;
                height: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.46);
                color: white;
                opacity: 0;
                pointer-events: none;
            }
            .bingsu-icon-delete svg {
                display: block;
                width: 8px;
                height: 8px;
                pointer-events: none;
            }
            .bingsu-icon-cell:hover .bingsu-icon-delete {
                opacity: 1;
                pointer-events: auto;
            }
            .bingsu-icon-color-section {
                margin: 12px 20px 0;
                padding-top: 12px;
                border-top: 1px solid var(--pk-hairline);
                flex-shrink: 0;
            }
            .bingsu-icon-color-label {
                margin-bottom: 8px;
                color: var(--pk-muted);
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            /* Same "colour slot" shape as the WebUI settings popover's
               renderColorPair: one pill per light/dark role, swatch + role
               glyph + hex on the left, a Change affordance on the right.
               Clicking opens the native colour-palette pop-up (Python side,
               bingsu_icon_chooser_color) instead of a flat swatch row. */
            .bingsu-icon-color-slots {
                display: flex;
                gap: 8px;
            }
            .bingsu-icon-color-slot {
                flex: 1 1 0;
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
                height: 48px;
                padding: 0 12px;
                border: 1px solid transparent;
                border-radius: 12px;
                background: var(--pk-inset);
                color: var(--pk-fg);
                cursor: pointer;
                text-align: left;
            }
            .bingsu-icon-color-slot:hover {
                background: var(--pk-inset-hover);
            }
            .bingsu-icon-color-swatch {
                flex: 0 0 auto;
                width: 22px;
                height: 22px;
                border-radius: 7px;
                border: 1px solid var(--pk-hairline);
                box-sizing: border-box;
            }
            .bingsu-icon-color-swatch.theme-default {
                background: var(--icon-color, #888888) !important;
            }
            .bingsu-icon-color-meta {
                flex: 1 1 auto;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .bingsu-icon-color-role {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 10.5px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--pk-muted);
            }
            .bingsu-icon-color-role svg {
                width: 11px;
                height: 11px;
            }
            .bingsu-icon-color-hex {
                font-size: 12.5px;
                font-weight: 600;
                font-variant-numeric: tabular-nums;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .bingsu-icon-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                height: 36px !important;
                min-width: 76px !important;
                padding: 0 16px !important;
                border: 1px solid transparent !important;
                border-radius: 10px !important;
                background: var(--pk-inset) !important;
                color: var(--pk-fg) !important;
                cursor: pointer;
                font-size: 13px !important;
                font-weight: 500 !important;
            }
            .bingsu-icon-btn:hover {
                background: var(--pk-inset-hover) !important;
            }
            .bingsu-icon-btn.primary {
                min-width: 72px !important;
                background: var(--pk-accent) !important;
                color: white !important;
                font-weight: 600 !important;
            }
            .bingsu-icon-btn.primary:hover {
                opacity: 0.9;
            }
            .bingsu-icon-upload {
                box-sizing: border-box !important;
                width: 100% !important;
                height: 48px !important;
                min-height: 48px !important;
                padding: 0 16px !important;
                border: none !important;
                border-radius: 14px !important;
                background: var(--pk-inset) !important;
                color: var(--pk-fg) !important;
                text-align: center !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer;
                font-size: 14px !important;
                font-weight: 500 !important;
            }
            .bingsu-icon-upload:hover {
                background: var(--pk-inset-hover) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function selectIcon(name) {
        state.selectedIcon = name;
        document.querySelectorAll(".bingsu-icon-cell.selected").forEach(cell => cell.classList.remove("selected"));
        document.querySelectorAll(".bingsu-icon-cell").forEach(cell => {
            if (cell.dataset.iconName === name) cell.classList.add("selected");
        });
    }

    function makeSearch(placeholder, onInput) {
        const row = document.createElement("div");
        row.className = "bingsu-icon-search-row";
        const input = document.createElement("input");
        input.className = "bingsu-icon-search";
        input.placeholder = placeholder;
        input.addEventListener("input", () => onInput(input.value.trim().toLowerCase()));
        row.appendChild(input);
        return row;
    }

    function makeGrid() {
        const grid = document.createElement("div");
        grid.className = "bingsu-icon-grid";
        return grid;
    }

    // The grid scrolls inside its own inset panel; the panel owns the rounding.
    function wrapGrid(grid) {
        const wrap = document.createElement("div");
        wrap.className = "bingsu-icon-grid-wrap";
        wrap.appendChild(grid);
        return wrap;
    }

    function xIconSvg(size = 14) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    }

    function renderSvgGrid(grid, items, filter) {
        grid.innerHTML = "";
        // One flat grid, no section labels. `items` already lists the user's
        // own icons before the system ones (see webview_handlers._icon_payload).
        items
            .filter(item => !filter || (item.label || item.name).toLowerCase().includes(filter))
            .forEach(item => {
                const cell = document.createElement("div");
                cell.className = "bingsu-icon-cell" + (state.selectedIcon === item.name ? " selected" : "");
                cell.dataset.iconName = item.name;
                cell.title = item.label || item.name;

                const icon = document.createElement("div");
                icon.className = "bingsu-icon-mask";
                icon.style.maskImage = `url("${item.url}")`;
                icon.style.webkitMaskImage = `url("${item.url}")`;
                cell.appendChild(icon);

                if (!item.system) {
                    const del = document.createElement("span");
                    del.className = "bingsu-icon-delete";
                    del.innerHTML = xIconSvg(11);
                    del.addEventListener("click", event => {
                        event.stopPropagation();
                        py(`bingsu_icon_chooser_delete_icon:${state.deckId}:${item.name}`);
                    });
                    cell.appendChild(del);
                }

                cell.addEventListener("click", () => selectIcon(item.name));
                grid.appendChild(cell);
            });
    }

    function buildIconsPane(data) {
        const pane = document.createElement("div");
        pane.className = "bingsu-icon-pane";
        pane.dataset.tabPane = "icons";
        const grid = makeGrid();
        pane.appendChild(makeSearch(T("search_icons_placeholder", "Search icons..."), filter => renderSvgGrid(grid, data.icons || [], filter)));
        pane.appendChild(wrapGrid(grid));
        renderSvgGrid(grid, data.icons || [], "");
        return pane;
    }

    function buildImagesPane(data) {
        const pane = document.createElement("div");
        pane.className = "bingsu-icon-pane";
        pane.dataset.tabPane = "images";
        const grid = makeGrid();
        const render = (filter) => {
            grid.innerHTML = "";
            (data.images || [])
                .filter(item => !filter || item.name.toLowerCase().includes(filter))
                .forEach(item => {
                    const cell = document.createElement("div");
                    cell.className = "bingsu-icon-cell" + (state.selectedIcon === item.name ? " selected" : "");
                    cell.dataset.iconName = item.name;
                    const img = document.createElement("img");
                    img.className = "bingsu-icon-image";
                    img.src = item.url;
                    cell.appendChild(img);
                    const del = document.createElement("span");
                    del.className = "bingsu-icon-delete";
                    del.innerHTML = xIconSvg(11);
                    del.addEventListener("click", event => {
                        event.stopPropagation();
                        py(`bingsu_icon_chooser_delete_icon:${state.deckId}:${item.name}`);
                    });
                    cell.appendChild(del);
                    cell.addEventListener("click", () => selectIcon(item.name));
                    grid.appendChild(cell);
                });
        };
        pane.appendChild(makeSearch("Search images", render));
        pane.appendChild(wrapGrid(grid));
        render("");
        return pane;
    }

    function buildEmojiPane() {
        const pane = document.createElement("div");
        pane.className = "bingsu-icon-pane";
        pane.dataset.tabPane = "emoji";
        const grid = makeGrid();
        const renderEmojis = (filter) => {
            Array.prototype.slice.call(grid.querySelectorAll(".bingsu-icon-cell")).forEach(cell => cell.remove());
            EMOJIS.filter(item => !filter || item.label.toLowerCase().includes(filter)).forEach(item => {
                const name = `emoji:${item.value}`;
                const cell = document.createElement("div");
                cell.className = "bingsu-icon-cell" + (state.selectedIcon === name ? " selected" : "");
                cell.dataset.iconName = name;
                cell.title = item.label;
                const img = document.createElement("img");
                img.className = "bingsu-icon-emoji-img";
                img.alt = item.label;
                img.src = `${state.emojiBaseUrl}/${item.asset}`;
                cell.appendChild(img);
                cell.addEventListener("click", () => selectIcon(name));
                grid.insertBefore(cell, grid.querySelector(".bingsu-icon-custom-emoji"));
            });
        };
        const custom = document.createElement("div");
        custom.className = "bingsu-icon-custom-emoji";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = T("type_your_own", "Type your own:");
        const input = document.createElement("input");
        input.type = "text";
        input.value = state.selectedIcon.indexOf("emoji:") === 0 && !EMOJIS.some(item => `emoji:${item.value}` === state.selectedIcon)
            ? state.selectedIcon.replace(/^emoji:/, "")
            : "";
        const selectCustomEmoji = () => {
            const emoji = input.value.trim();
            if (!emoji) return;
            selectIcon(`emoji:${emoji}`);
        };
        button.addEventListener("click", () => {
            input.focus();
            selectCustomEmoji();
        });
        input.addEventListener("input", selectCustomEmoji);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                selectCustomEmoji();
            }
        });
        custom.appendChild(button);
        custom.appendChild(input);
        grid.appendChild(custom);
        pane.appendChild(makeSearch("Search emoji", renderEmojis));
        pane.appendChild(wrapGrid(grid));
        renderEmojis("");
        return pane;
    }

    function buildUploadPane() {
        const pane = document.createElement("div");
        pane.className = "bingsu-icon-pane";
        pane.dataset.tabPane = "upload";
        pane.style.gap = "10px";
        ["Upload SVG icon", "Upload PNG image"].forEach((label, index) => {
            const button = document.createElement("span");
            button.className = "bingsu-icon-upload";
            button.textContent = label;
            button.addEventListener("click", () => {
                py(`${index === 0 ? "bingsu_icon_chooser_add_icon" : "bingsu_icon_chooser_add_image"}:${state.deckId}`);
            });
            pane.appendChild(button);
        });
        return pane;
    }

    function setTab(tab) {
        document.querySelectorAll(".bingsu-icon-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tab);
        });
        document.querySelectorAll(".bingsu-icon-pane").forEach(pane => {
            pane.classList.toggle("active", pane.dataset.tabPane === tab);
        });
        const colorSection = document.querySelector(".bingsu-icon-color-section");
        if (colorSection) colorSection.style.display = tab === "icons" ? "" : "none";
    }

    function applyThemeColorMode() {
        const modal = document.querySelector(".bingsu-icon-modal");
        if (modal) modal.classList.toggle("theme-icon-color", activeColor() === THEME_COLOR);
        document.documentElement.style.setProperty("--bingsu-selected-icon-color", activeColor() || "#888888");
    }

    // Two colour slots — Light and Dark — same shape as the WebUI settings
    // popover's colour-pair rows. Each opens the native colour-palette pop-up
    // (Python side) instead of a flat swatch row baked into the page.
    function buildColorSection() {
        const section = document.createElement("div");
        section.className = "bingsu-icon-color-section";
        const label = document.createElement("div");
        label.className = "bingsu-icon-color-label";
        label.textContent = T("icon_label", "Icon Color");
        section.appendChild(label);

        const slots = document.createElement("div");
        slots.className = "bingsu-icon-color-slots";
        section.appendChild(slots);

        function paintSlot(slotEl, hex) {
            const swatch = slotEl.querySelector(".bingsu-icon-color-swatch");
            swatch.classList.toggle("theme-default", hex === THEME_COLOR);
            swatch.style.background = hex || "";
            slotEl.querySelector(".bingsu-icon-color-hex").textContent =
                hex ? hex.toUpperCase() : "Default";
        }

        function makeSlot(role, glyph, roleLabel) {
            const slot = document.createElement("button");
            slot.type = "button";
            slot.className = "bingsu-icon-color-slot";
            const swatch = document.createElement("span");
            swatch.className = "bingsu-icon-color-swatch";
            slot.appendChild(swatch);
            const meta = document.createElement("span");
            meta.className = "bingsu-icon-color-meta";
            const roleRow = document.createElement("span");
            roleRow.className = "bingsu-icon-color-role";
            roleRow.innerHTML = glyph;
            roleRow.appendChild(document.createTextNode(roleLabel));
            meta.appendChild(roleRow);
            const hexLabel = document.createElement("span");
            hexLabel.className = "bingsu-icon-color-hex";
            meta.appendChild(hexLabel);
            slot.appendChild(meta);
            slot.addEventListener("click", () => {
                const current = role === "dark" ? state.selectedColorDark : state.selectedColorLight;
                if (window.BingsuMobile && BingsuMobile.isTouch()) {
                    // iOS: the system colour picker, from the page itself.
                    pickColorInPage(current || "#00A982", (hex) => window.BingsuIconChooser.applyColor(role, hex));
                    return;
                }
                py(`bingsu_icon_chooser_color:${state.deckId}:${role}:${current || "#00A982"}`);
            });
            slots.appendChild(slot);
            return slot;
        }

        const lightSlot = makeSlot("light", SUN_ICON, "Light");
        const darkSlot = makeSlot("dark", MOON_ICON, "Dark");

        paintSlot(lightSlot, state.selectedColorLight);
        paintSlot(darkSlot, state.selectedColorDark);
        applyThemeColorMode();

        section.__paint = () => {
            paintSlot(lightSlot, state.selectedColorLight);
            paintSlot(darkSlot, state.selectedColorDark);
            applyThemeColorMode();
        };
        return section;
    }

    // Touch screens: a colour input opens the system colour picker (iOS
    // UIColorPickerViewController) over the page. It has to be in the
    // document and is reused.
    function pickColorInPage(current, done) {
        let input = document.getElementById("bingsu-icon-color-input");
        if (!input) {
            input = document.createElement("input");
            input.type = "color";
            input.id = "bingsu-icon-color-input";
            input.setAttribute("aria-hidden", "true");
            input.style.cssText = "position:fixed;left:50%;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;";
            document.body.appendChild(input);
        }
        const hex = /^#[0-9a-f]{6}$/i.test(current) ? current : "#00a982";
        input.value = hex;
        input.oninput = input.onchange = () => done(input.value);
        input.click();
    }

    function open(data) {
        close();
        ensureStyles();
        state.deckId = String(data.deckId || "");
        state.selectedIcon = (data.current && data.current.icon) || "";
        state.selectedColorLight = (data.current && data.current.color) || THEME_COLOR;
        state.selectedColorDark = (data.current && data.current.colorDark) || state.selectedColorLight;
        state.emojiBaseUrl = data.emojiBaseUrl || state.emojiBaseUrl;
        state.data = data;
        document.documentElement.style.setProperty("--bingsu-selected-icon-color", activeColor() || "#888888");

        const backdrop = document.createElement("div");
        backdrop.id = "bingsu-icon-backdrop";
        backdrop.addEventListener("click", close);

        const modal = document.createElement("div");
        modal.className = "bingsu-icon-modal" + (activeColor() === THEME_COLOR ? " theme-icon-color" : "");
        modal.addEventListener("click", event => event.stopPropagation());

        const header = document.createElement("div");
        header.className = "bingsu-icon-modal-header";
        const title = document.createElement("div");
        title.className = "bingsu-icon-modal-title";
        title.textContent = T("edit_icon", "Edit Icon");
        const closeBtn = document.createElement("span");
        closeBtn.className = "bingsu-icon-modal-close";
        closeBtn.innerHTML = xIconSvg(15);
        closeBtn.setAttribute("aria-label", T("close", "Close"));
        closeBtn.title = T("close", "Close");
        closeBtn.addEventListener("click", close);
        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const tabs = document.createElement("div");
        tabs.className = "bingsu-icon-tabs";
        [
            ["emoji", "Emoji"],
            ["icons", "Icons"],
            ["images", "Images"],
            ["upload", "Upload"],
        ].forEach(([id, label]) => {
            const btn = document.createElement("span");
            btn.className = "bingsu-icon-tab";
            btn.dataset.tab = id;
            btn.textContent = label;
            btn.addEventListener("click", () => setTab(id));
            tabs.appendChild(btn);
        });
        modal.appendChild(tabs);

        const body = document.createElement("div");
        body.className = "bingsu-icon-body";
        body.appendChild(buildEmojiPane());
        body.appendChild(buildIconsPane(data));
        body.appendChild(buildImagesPane(data));
        body.appendChild(buildUploadPane());
        modal.appendChild(body);
        modal.appendChild(buildColorSection());

        const footer = document.createElement("div");
        footer.className = "bingsu-icon-modal-footer";
        const reset = document.createElement("span");
        reset.className = "bingsu-icon-btn";
        reset.textContent = T("reset_to_default_tooltip", "Reset to Default");
        reset.addEventListener("click", () => {
            py(`bingsu_icon_chooser_reset:${state.deckId}`);
            close();
        });
        const cancel = document.createElement("span");
        cancel.className = "bingsu-icon-btn";
        cancel.textContent = T("cancel", "Cancel");
        cancel.addEventListener("click", close);
        const save = document.createElement("span");
        save.className = "bingsu-icon-btn primary";
        save.textContent = T("save", "Save");
        save.addEventListener("click", () => {
            const payload = JSON.stringify({
                icon: state.selectedIcon,
                color: state.selectedColorLight,
                colorDark: state.selectedColorDark,
            });
            py(`bingsu_icon_chooser_save:${state.deckId}:${payload}`);
            close();
        });
        // Same order as the Qt pickers: Save, Cancel, Reset, centred.
        footer.appendChild(save);
        footer.appendChild(cancel);
        footer.appendChild(reset);
        modal.appendChild(footer);

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const initialTab = state.selectedIcon.indexOf("emoji:") === 0
            ? "emoji"
            : (state.selectedIcon.toLowerCase().endsWith(".png") ? "images" : "icons");
        setTab(initialTab);
    }

    return {
        open,
        close,
        // Called from Python once the native colour-palette pop-up closes
        // (webview_handlers._cmd via bingsu_icon_chooser_color); the modal
        // itself never runs a colour dialog, it only relays the result.
        applyColor(role, hex) {
            if (role === "dark") state.selectedColorDark = hex;
            else state.selectedColorLight = hex;
            document.documentElement.style.setProperty("--bingsu-selected-icon-color", activeColor() || "#888888");
            const modal = document.querySelector(".bingsu-icon-modal");
            if (modal) modal.classList.toggle("theme-icon-color", activeColor() === THEME_COLOR);
            const section = document.querySelector(".bingsu-icon-color-section");
            if (section && section.__paint) section.__paint();
        },
        refreshData(data) {
            const icon = state.selectedIcon;
            const color = state.selectedColorLight;
            const colorDark = state.selectedColorDark;
            open({ ...data, current: { icon, color, colorDark } });
        },
    };
})();
