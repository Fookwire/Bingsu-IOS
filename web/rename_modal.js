window.BingsuRenameDeckModal = (function () {
    const state = {
        deckId: "",
        parentPrefix: "",
    };

    function py(command) {
        if (typeof pycmd === "function") pycmd(command);
    }

    function close() {
        const backdrop = document.getElementById("bingsu-rename-backdrop");
        if (backdrop) backdrop.remove();
    }

    // Shared light/dark tokens for Bingsu dialogs. They read the Bingsu palette
    // (which flips on .night-mode) instead of Anki's --canvas*, so a dialog can
    // never end up with light-theme surfaces under dark-theme text.
    function T(key, fallback) {
        if (window.BingsuI18n && typeof BingsuI18n.t === 'function') {
            return BingsuI18n.t(key, fallback);
        }
        return fallback;
    }

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
        if (document.getElementById("bingsu-rename-modal-styles")) return;
        const style = document.createElement("style");
        style.id = "bingsu-rename-modal-styles";
        style.textContent = `
            #bingsu-rename-backdrop {
                position: fixed;
                inset: 0;
                z-index: 200001;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--odlg-scrim, rgba(0, 0, 0, 0.46));
            }
            #bingsu-rename-backdrop button,
            #bingsu-rename-backdrop input {
                -webkit-appearance: none !important;
                appearance: none !important;
                box-sizing: border-box !important;
                font-family: inherit !important;
                letter-spacing: 0 !important;
                outline: none !important;
            }
            .bingsu-rename-modal {
                position: relative;
                width: min(390px, calc(100vw - 36px));
                border: 1px solid var(--odlg-border, rgba(0,0,0,0.14));
                border-radius: 14px;
                background: var(--odlg-surface, #ffffff);
                color: var(--odlg-fg, #212121);
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
                overflow: hidden;
            }
            .bingsu-rename-header {
                display: flex;
                align-items: center;
                padding: 16px 18px 8px;
            }
            .bingsu-rename-title {
                font-size: 15px;
                font-weight: 650;
                line-height: 1.2;
            }
            .bingsu-rename-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 30px;
                height: 30px;
                padding: 0 !important;
                border: 0 !important;
                border-radius: 8px !important;
                background: transparent !important;
                color: var(--odlg-fg-subtle, #757575) !important;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .bingsu-rename-close:hover {
                color: var(--odlg-fg-subtle, #757575) !important;
                background: transparent !important;
            }
            .bingsu-rename-close svg {
                width: 15px;
                height: 15px;
                pointer-events: none;
            }
            .bingsu-rename-body {
                padding: 8px 18px 16px;
            }
            .bingsu-rename-label {
                display: block;
                margin-bottom: 7px;
                color: var(--odlg-fg-subtle, #757575);
                font-size: 12px;
                font-weight: 650;
                text-transform: uppercase;
            }
            .bingsu-rename-path {
                display: none;
                margin-bottom: 10px;
                color: var(--odlg-fg-subtle, #757575);
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .bingsu-rename-path.visible {
                display: block;
            }
            .bingsu-rename-input {
                width: 100%;
                height: 40px;
                padding: 0 12px;
                border: 1px solid var(--odlg-border, rgba(0,0,0,0.14));
                border-radius: 10px;
                background: var(--odlg-inset, #ffffff);
                color: var(--odlg-fg, #212121);
                font-size: 14px;
            }
            .bingsu-rename-input:focus {
                border-color: var(--odlg-accent, #0077C8);
                box-shadow: inset 0 0 0 1px var(--odlg-accent, #0077C8);
            }
            .bingsu-rename-error {
                min-height: 18px;
                margin-top: 7px;
                color: #ff5f57;
                font-size: 12px;
            }
            .bingsu-rename-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
                padding: 14px 18px 18px;
            }
            .bingsu-rename-btn {
                height: 34px;
                min-width: 82px;
                padding: 0 14px !important;
                border: 1px solid transparent !important;
                border-radius: 9px !important;
                cursor: pointer;
                font-size: 13px !important;
                font-weight: 650 !important;
                transform: none !important;
            }
            .bingsu-rename-btn.secondary {
                background: var(--odlg-highlight, rgba(0,0,0,0.06)) !important;
                color: var(--odlg-fg, #212121) !important;
            }
            .bingsu-rename-btn.primary {
                background: var(--odlg-accent, #0077C8) !important;
                color: white !important;
            }
            .bingsu-rename-btn:hover {
                filter: none !important;
                box-shadow: none !important;
                transform: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function submit() {
        const input = document.getElementById("bingsu-rename-input");
        const error = document.getElementById("bingsu-rename-error");
        if (!input) return;
        const name = input.value.trim();
        if (!name) {
            if (error) error.textContent = T("deck_name_empty", "Deck name cannot be empty.");
            input.focus();
            return;
        }
        py(`bingsu_rename_deck:${state.deckId}:${encodeURIComponent(JSON.stringify({ name }))}`);
        close();
    }

    function open(payload) {
        ensureStyles();
        close();
        state.deckId = String(payload.deckId || "");
        state.parentPrefix = payload.parentPrefix || "";

        const backdrop = document.createElement("div");
        backdrop.id = "bingsu-rename-backdrop";
        backdrop.addEventListener("click", close);

        const modal = document.createElement("div");
        modal.className = "bingsu-rename-modal";
        modal.addEventListener("click", event => event.stopPropagation());

        const header = document.createElement("div");
        header.className = "bingsu-rename-header";
        const title = document.createElement("div");
        title.className = "bingsu-rename-title";
        title.textContent = T("rename_deck_title", "Rename Deck");
        const closeBtn = document.createElement("span");
        closeBtn.className = "bingsu-rename-close";
        closeBtn.setAttribute('role', 'button');
        closeBtn.tabIndex = 0;
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        closeBtn.addEventListener("click", close);
        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "bingsu-rename-body";
        const label = document.createElement("label");
        label.className = "bingsu-rename-label";
        label.setAttribute("for", "bingsu-rename-input");
        label.textContent = T("deck_name_label", "Deck name");
        const path = document.createElement("div");
        path.className = "bingsu-rename-path" + (state.parentPrefix ? " visible" : "");
        path.textContent = state.parentPrefix ? `${state.parentPrefix} ::` : "";
        const input = document.createElement("input");
        input.id = "bingsu-rename-input";
        input.className = "bingsu-rename-input";
        input.type = "text";
        input.value = payload.leafName || "";
        input.autocomplete = "off";
        input.spellcheck = false;
        const error = document.createElement("div");
        error.id = "bingsu-rename-error";
        error.className = "bingsu-rename-error";
        input.addEventListener("input", () => {
            error.textContent = "";
        });
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") close();
        });
        body.appendChild(label);
        body.appendChild(path);
        body.appendChild(input);
        body.appendChild(error);

        const footer = document.createElement("div");
        footer.className = "bingsu-rename-footer";
        const cancel = document.createElement("span");
        cancel.className = "bingsu-rename-btn secondary";
        cancel.setAttribute('role', 'button');
        cancel.tabIndex = 0;
        cancel.textContent = T("cancel", "Cancel");
        cancel.addEventListener("click", close);
        const save = document.createElement("span");
        save.className = "bingsu-rename-btn primary";
        save.setAttribute('role', 'button');
        save.tabIndex = 0;
        save.textContent = T("save", "Save");
        save.addEventListener("click", submit);
        footer.appendChild(cancel);
        footer.appendChild(save);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.getElementById("bingsu-rename-backdrop")) {
            close();
        }
    });

    return { open, close };
})();
