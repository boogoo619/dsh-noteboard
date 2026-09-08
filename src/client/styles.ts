export const CANVAS_CSS = `
.nb-root,.nb-overlay{--nb-bg:var(--dsw-alias-bg-base,#f8f9fa);--nb-surface:var(--dsw-alias-bg-layer-1,#fff);--nb-muted:var(--dsw-alias-label-secondary,#73777e);--nb-text:var(--dsw-alias-label-primary,#24272c);--nb-border:var(--dsw-alias-border-l1,#dfe1e5);--nb-accent:var(--dsw-alias-state-accent-primary,#4264e8);--nb-hover:var(--dsw-alias-interactive-bg-hover,#f0f1f4);--nb-shadow:var(--dsw-elevation-panel,0 2px 8px #0000000d,0 0 0 1px #0000000c);font-family:inherit;color:var(--nb-text);font-size:13px;line-height:1.5;letter-spacing:0;color-scheme:inherit}
.nb-root *,.nb-overlay *{box-sizing:border-box;letter-spacing:0}
.nb-root{position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:hidden;container-type:inline-size}
.nb-root button,.nb-overlay button{font:inherit;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;flex-shrink:0}
.nb-overlay input,.nb-overlay textarea{font:inherit;color:inherit;min-width:0;background:var(--nb-surface);border:1px solid var(--nb-border);border-radius:6px;padding:8px 10px}
.nb-root button:disabled,.nb-overlay button:disabled{opacity:.42;cursor:not-allowed}
.nb-root button:focus-visible,.nb-overlay button:focus-visible,.nb-root input:focus-visible,.nb-root textarea:focus-visible{outline:2px solid var(--nb-accent);outline-offset:3px}
.nb-root input,.nb-root textarea,.nb-root select,.nb-overlay input{font:inherit;color:inherit;min-width:0;background:var(--nb-surface);border:1px solid var(--nb-border);border-radius:6px;padding:8px 10px}
.nb-root input::placeholder,.nb-root textarea::placeholder{color:var(--nb-muted)}
.nb-board{position:absolute;inset:0;overflow:hidden;touch-action:none;outline:none;background:var(--nb-bg)}
.nb-grid{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,var(--nb-border) .8px,transparent .9px)}
.nb-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.nb-pan-mode,.nb-pan-mode .nb-card{cursor:grab}.nb-pan-mode:active{cursor:grabbing}
.nb-chrome{position:absolute;inset:0;pointer-events:none;z-index:5}
.nb-float{position:absolute;display:flex;align-items:center;gap:4px;padding:5px;border-radius:8px;background:var(--nb-surface);box-shadow:var(--nb-shadow);pointer-events:auto;min-height:44px}
.nb-canvas-controls{top:16px;left:16px;padding-left:12px;max-width:calc(100% - 285px)}
.nb-canvas-controls select{border:0;background:transparent;font-weight:600;max-width:180px;text-overflow:ellipsis;padding:4px 2px;height:32px;cursor:pointer}
.nb-view-tools{right:16px;top:16px}.nb-zoom-step{display:inline-flex}.nb-zoom-menu{left:auto;right:0;width:140px}
.nb-save-status{color:var(--nb-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nb-zoom-value{border:0;background:transparent;width:46px;height:32px;font-size:12px!important;font-variant-numeric:tabular-nums}
.nb-icon{width:32px;height:32px;padding:0;border:0;border-radius:5px;background:transparent;position:relative}
.nb-icon:hover,.nb-zoom-value:hover{background:var(--nb-hover)}
.nb-icon.is-active{background:color-mix(in srgb,var(--nb-accent) 12%,var(--nb-surface));color:var(--nb-accent)}
.nb-rule{width:1px;height:20px;background:var(--nb-border);margin:0 4px;flex-shrink:0}
.nb-fallback-tools{left:50%;bottom:16px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:0}
.nb-button,.nb-btn{border:1px solid var(--nb-border);background:var(--nb-surface);border-radius:6px;padding:7px 12px;min-height:34px;font:inherit;cursor:pointer;color:inherit}
.nb-button:hover,.nb-btn:hover{background:var(--nb-hover)}
.nb-primary,.nb-btn-primary{background:var(--nb-accent)!important;color:#fff!important;border-color:transparent}
.nb-muted,.nb-count{color:var(--nb-muted);font-size:12px}.nb-danger{color:var(--dsw-alias-state-error-primary,#bc3c4b)!important}
.nb-dropdown{position:absolute;top:calc(100% + 8px);left:0;width:200px;background:var(--nb-surface);box-shadow:var(--nb-shadow);border-radius:8px;overflow:hidden}
.nb-menu-list{padding:5px;display:flex;flex-direction:column;gap:2px}
.nb-menu-list button{border:0;background:transparent;justify-content:flex-start;padding:8px 10px;border-radius:4px;min-height:34px;text-align:left;white-space:normal}
.nb-menu-list button:hover{background:var(--nb-hover)}
.nb-card{position:absolute;border-radius:7px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;background:var(--nb-note);color:var(--nb-ink);border:1px solid color-mix(in srgb,var(--nb-ink) 13%,transparent);box-shadow:0 2px 3px #00000006;overflow:hidden;cursor:grab;user-select:none}
.color-yellow{--nb-note:#faf4ce;--nb-ink:#454020}.color-pink{--nb-note:#f8e5ec;--nb-ink:#523541}.color-blue{--nb-note:#e4eef9;--nb-ink:#304659}.color-green{--nb-note:#e5f1e5;--nb-ink:#334e3a}.color-orange{--nb-note:#faebda;--nb-ink:#60452d}.color-purple{--nb-note:#eee8f7;--nb-ink:#493c61}.color-gray{--nb-note:#eceef0;--nb-ink:#3f454c}
body[data-ds-dark-theme] .color-yellow{--nb-note:#393727;--nb-ink:#eee6b9}body[data-ds-dark-theme] .color-pink{--nb-note:#3e2e37;--nb-ink:#f2d4e1}body[data-ds-dark-theme] .color-blue{--nb-note:#293641;--nb-ink:#d0e2f4}body[data-ds-dark-theme] .color-green{--nb-note:#2d3b32;--nb-ink:#d3e7d5}body[data-ds-dark-theme] .color-orange{--nb-note:#42362c;--nb-ink:#f1dabe}body[data-ds-dark-theme] .color-purple{--nb-note:#373043;--nb-ink:#e1d8ef}body[data-ds-dark-theme] .color-gray{--nb-note:#343638;--nb-ink:#e1e3e6}
.nb-selected{outline:2px solid var(--nb-accent);outline-offset:2px}
.nb-faded{opacity:.28}.nb-pulse{animation:nb-pulse .7s ease-in-out 2}@keyframes nb-pulse{50%{outline:4px solid var(--nb-accent);outline-offset:6px}}
.nb-card-title{font-size:14px;font-weight:600;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere;flex-shrink:0}
.nb-card-body{font-size:12px;line-height:1.6;overflow:hidden;flex:1;min-height:0;overflow-wrap:anywhere}.nb-body-overflow{mask-image:linear-gradient(#000 0%,#000 calc(100% - 12px),transparent 100%)}
.nb-card-body p{margin:0 0 6px}.nb-card-body ul,.nb-card-body ol{margin:0 0 5px;padding-left:17px}.nb-card-body pre{white-space:pre-wrap;margin:0 0 5px;background:color-mix(in srgb,var(--nb-ink) 7%,transparent);padding:5px;border-radius:4px}.nb-card-body code{font-size:11px;font-family:ui-monospace,monospace}
.nb-card-tags{display:flex;align-items:center;gap:5px;height:21px;min-height:21px;overflow:hidden}
.nb-tag{background:color-mix(in srgb,var(--nb-ink,currentColor) 5%,transparent);border:1px solid color-mix(in srgb,var(--nb-ink,currentColor) 13%,transparent);border-radius:4px;padding:1px 6px;font-size:10px!important;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:20px}
.nb-text{position:absolute;color:var(--nb-ink);cursor:grab;user-select:none;border-radius:2px}
.nb-text-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;font-family:inherit;font-weight:400}
.nb-place-text,.nb-place-text .nb-card,.nb-place-text .nb-text{cursor:crosshair}
.nb-text-editor{position:absolute;z-index:4;color:var(--nb-ink);line-height:1.5}
.nb-text-editor textarea{display:block;width:100%;min-height:30px;max-height:min(420px,60vh);resize:none;overflow:auto;font:inherit;line-height:1.5;padding:0;border:0;border-radius:2px;background:var(--nb-surface);color:inherit;outline:2px solid var(--nb-accent);outline-offset:3px}
.nb-text-error{font-size:12px;color:var(--dsw-alias-state-error-primary,#bc3c4b);background:var(--nb-surface);padding:6px;overflow-wrap:anywhere}
.nb-text-error button{margin-left:8px}.nb-selection-tools select{font:inherit;padding:3px;border:1px solid var(--nb-border);border-radius:4px;background:var(--nb-surface);color:var(--nb-text)}
.nb-marquee{position:absolute;border:1px solid var(--nb-accent);background:color-mix(in srgb,var(--nb-accent) 9%,transparent);pointer-events:none;z-index:4}
.nb-empty{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:14px;align-items:center;color:var(--nb-muted);max-width:80%;overflow-wrap:anywhere}.nb-empty h2{font-size:18px;font-weight:500;margin:0;color:var(--nb-text)}
.nb-selection-tools{z-index:12;background:var(--nb-surface);color:var(--nb-text);box-shadow:var(--nb-shadow);border-radius:8px;max-width:calc(100% - 24px)}
.nb-tool-row{display:flex;align-items:center;gap:2px;padding:5px;min-height:42px}.nb-selection-count{font-size:12px;padding:0 8px;white-space:nowrap}
.nb-color-indicator{display:inline-block;background:var(--nb-note);border:1px solid color-mix(in srgb,var(--nb-ink) 35%,transparent);border-radius:50%;width:17px;height:17px;flex-shrink:0;corner-shape:round}
.nb-mixed{background:conic-gradient(#a6bdeb 0deg 120deg,#e7baad 120deg 240deg,#a6c6ad 240deg);border:1px solid var(--nb-border)}
.nb-popover-body{padding:12px;border-top:1px solid var(--nb-border)}.nb-colors{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nb-swatch{background:var(--nb-note);color:var(--nb-ink);border:1px solid color-mix(in srgb,var(--nb-ink) 30%,transparent);border-radius:50%;width:24px;height:24px;padding:0;corner-shape:round}
.nb-swatch[aria-pressed=true]{outline:2px solid var(--nb-accent);outline-offset:2px}.nb-swatch span{width:6px;height:6px;border-radius:50%;background:var(--nb-ink);corner-shape:round}
.nb-tag-panel{width:260px;max-height:300px;overflow:auto}.nb-tag-option{display:flex;justify-content:space-between}.nb-tag-option>button:first-child{border:0;background:none;justify-content:space-between;flex:1;padding:4px}.nb-tag-panel form{display:flex;gap:6px;margin-top:8px}.nb-tag-panel input{width:100%;min-width:0}
.nb-focus-filter{position:absolute;left:16px;top:76px;pointer-events:auto}
.nb-alert{position:absolute;top:76px;left:50%;transform:translateX(-50%);z-index:18;background:var(--nb-surface);border:1px solid var(--dsw-alias-state-error-primary,#bc3c4b);border-radius:7px;box-shadow:var(--nb-shadow);padding:6px 8px 6px 14px;display:flex;align-items:center;gap:8px;max-width:min(560px,90%);overflow-wrap:anywhere}
.nb-drawer{position:absolute;right:12px;top:72px;bottom:72px;width:320px;max-width:calc(100% - 24px);z-index:10;background:var(--nb-surface);border:1px solid var(--nb-border);border-radius:8px;display:flex;flex-direction:column;box-shadow:var(--nb-shadow);overflow:hidden}
.nb-drawer header,.nb-dialog header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--nb-border);gap:10px;flex-shrink:0}.nb-search-input{margin:12px;flex-shrink:0}.nb-results{overflow:auto;min-height:0;flex:1;padding:4px 12px}.nb-results>p{padding:12px}
.nb-result{display:flex;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid var(--nb-border)}.nb-result>button:not(.nb-icon){display:flex;flex-direction:column;align-items:flex-start;flex:1;min-width:0;flex-shrink:1;border:0;background:none;padding:0;text-align:left;gap:5px}.nb-result strong,.nb-result small{max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}.nb-result small{color:var(--nb-muted);font-size:11px}.nb-result strong{font-weight:500}
.nb-modal-mask{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;background:#00000055}
.nb-dialog{background:var(--nb-surface);color:var(--nb-text);border-radius:8px;box-shadow:var(--nb-shadow);width:420px;max-width:100%;max-height:calc(100dvh - 40px);display:flex;flex-direction:column;overflow:hidden}.nb-dialog-wide{width:780px}
.nb-editor{padding:16px 20px;display:flex;flex-direction:column;gap:14px;min-height:0}.nb-title-input{font-size:20px!important;font-weight:600;border:0!important;padding:4px 0!important;border-radius:0!important;width:100%}
.nb-editor-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.nb-tag-input{width:100px;border:0!important;padding:3px!important;font-size:12px!important}
.nb-tabs{display:flex;gap:16px;border-bottom:1px solid var(--nb-border);padding:0 12px}.nb-tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:8px 3px;color:var(--nb-muted)}.nb-tabs button[aria-selected=true]{color:var(--nb-text);border-bottom-color:var(--nb-accent)}
.nb-body-input,.nb-preview{height:min(42vh,380px);min-height:140px;overflow:auto;resize:none;line-height:1.7!important;width:100%;font-size:14px!important}.nb-preview{padding:8px}.nb-prose{overflow-wrap:anywhere}.nb-prose pre{background:var(--nb-hover);padding:12px;overflow:auto;border-radius:5px}.nb-prose code{font-family:ui-monospace,monospace;font-size:12px}.nb-prose table{border-collapse:collapse;display:block;overflow:auto}.nb-prose th,.nb-prose td{border:1px solid var(--nb-border);padding:5px 8px}.nb-prose blockquote{border-left:3px solid var(--nb-border);margin:8px 0;padding-left:14px;color:var(--nb-muted)}
.nb-dialog footer,.nb-editor footer{display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-shrink:0}.nb-dialog>footer{padding:12px 16px}.nb-editor footer .nb-muted{margin-right:auto}.nb-error{color:var(--dsw-alias-state-error-primary,#bc3c4b);font-size:12px;margin:0;overflow-wrap:anywhere}
.nb-form,.nb-source{padding:18px;display:flex;flex-direction:column;gap:14px;overflow:auto}.nb-source blockquote{margin:0;padding:12px;background:var(--nb-hover);border-left:2px solid var(--nb-accent);white-space:pre-wrap;max-height:45vh;overflow:auto;overflow-wrap:anywhere}
.nb-history-diff{padding:16px;overflow:auto}.nb-history-diff section{margin-bottom:18px}.nb-history-diff section>strong{font-size:12px;overflow-wrap:anywhere}.nb-history-diff section>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nb-history-diff pre{padding:10px;background:var(--nb-hover);overflow:auto;font-size:11px;max-height:40vh;white-space:pre-wrap;overflow-wrap:anywhere}
.nb-loading{display:flex;align-items:center;justify-content:center;flex-direction:column;background:var(--nb-bg);color:var(--nb-muted)}
.nb-overlay{pointer-events:none}.nb-capture,.nb-notices,.nb-return{pointer-events:auto;position:fixed;z-index:60;background:var(--nb-surface);color:var(--nb-text);border-radius:8px;box-shadow:var(--nb-shadow)}.nb-capture{display:flex;padding:5px;gap:4px;max-width:calc(100vw - 24px)}.nb-notices{top:100px;left:50%;transform:translateX(-50%);max-width:min(540px,calc(100vw - 32px));min-width:260px}.nb-notice{display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid var(--nb-border)}.nb-notice:last-child{border:0}.nb-notice-text{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px}.nb-notice-actions{display:flex;gap:4px;flex-shrink:0}.nb-return{left:50%;top:100px;transform:translateX(-50%);padding:7px 12px}.nb-notice-more{background:transparent;border:0;width:100%;padding:7px}.nb-source-highlight{background:color-mix(in srgb,var(--nb-accent,#4264e8) 25%,transparent)}
::highlight(noteboard-source){background:#f6d86a88;color:inherit}
.nb-set-card{display:flex;flex-direction:column;gap:16px;max-width:560px}.nb-set-field{display:flex;flex-direction:column;gap:6px}.nb-set-label{font-size:13px;font-weight:500}.nb-set-select,.nb-set-textarea{font:inherit;font-size:13px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#24272c)}.nb-set-hint,.nb-set-status{font-size:12px;color:var(--dsw-alias-label-secondary,#73777e);margin:0}.nb-set-footer{display:flex;align-items:center;justify-content:space-between}
@container (max-width:600px){.nb-canvas-controls{max-width:calc(100% - 168px);top:12px;left:12px;padding-left:6px;gap:2px}.nb-canvas-controls>svg{display:none}.nb-canvas-controls select{max-width:130px;min-width:32px;width:100%}.nb-save-status{display:none}.nb-view-tools{top:12px;right:12px;gap:0}.nb-zoom-step{display:none}.nb-view-tools .nb-rule{margin:0 2px}.nb-focus-filter{top:70px;left:12px}.nb-history-diff section>div{grid-template-columns:1fr}.nb-selection-tools{max-width:calc(100% - 24px)}.nb-tool-row{gap:0}.nb-tool-row .nb-icon{width:29px}}
.nb-host-seat,.nb-host-seat *{box-sizing:border-box}
.nb-host [data-width-handle]{display:none!important;pointer-events:none!important}
.nb-host-scroll{position:relative!important;overflow:hidden!important;scrollbar-gutter:auto!important}
.nb-host-session{display:flex!important;flex:1 1 0!important;min-height:0!important;overflow:hidden!important}
.nb-host-view{display:flex!important;flex:1 1 0!important;min-height:0!important;height:100%;overflow:hidden!important}
.nb-host-seat{position:absolute!important;left:50%!important;right:auto!important;bottom:16px!important;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);max-height:calc(var(--nb-available-height,600px) * .6);min-height:44px;background:transparent!important;border:0;box-shadow:none;overflow:visible;z-index:15!important}
.nb-host-seat:has([data-nb-composer-mode=input]){width:min(560px,calc(100% - 32px));min-height:48px}
.nb-host-seat>div,.nb-host-seat>div>div{min-height:0;max-height:inherit;gap:0!important}
.nb-host-seat [data-chain-overlay-fallback]>div{min-height:0;flex:1;overflow:visible;gap:0!important}
.nb-host-seat:has([data-nb-composer-mode=tools]) [data-slot="conversation.composer.bar"]{display:none!important}
.nb-host-seat [data-slot="conversation.input.dock"]{overflow:visible;flex-shrink:0}
.nb-host-seat [data-slot="conversation.input.dock"]>:not(.nb-reference-dock){display:none!important}
.nb-host-seat .nb-reference-dock{margin:0 0 8px;padding:0}
.nb-host-seat:has([data-nb-composer-mode=tools]) [data-slot="conversation.input.dock"]{display:none!important}
.nb-composer-custom{width:100%;min-width:0;min-height:0;max-height:inherit;pointer-events:none;overflow:visible}
.nb-composer-custom[data-nb-composer-mode=input]{height:100%}
.nb-host-seat [data-slot="conversation.composer.bar"]>div{width:100%!important;max-width:none!important;min-height:0;margin:0!important;padding:0!important}
.nb-host-seat [data-composer-card]{width:100%!important;max-width:none!important;background:var(--dsw-alias-bg-layer-1,#fff)!important;border:1px solid var(--dsw-alias-border-l1,#dfe1e5)!important;box-shadow:0 3px 16px #00000014!important;margin:0!important;border-radius:8px!important;padding:0!important;overflow:visible!important}
.nb-host-seat [data-composer-card]>:last-child{display:none!important}
.nb-host-seat [data-slot="conversation.composer.dock"]{display:none!important}
.nb-host-seat [data-input-scroll]{min-height:46px!important;max-height:min(156px,calc(var(--nb-available-height,600px) * .6 - 40px))!important;overflow:auto!important;padding:12px 44px!important;overscroll-behavior:contain;flex:0 1 auto!important}
.nb-host-seat:has([data-nb-running=true]) [data-input-scroll]{padding-right:80px!important}
.nb-host-seat [data-composer-card]{gap:0!important}
.nb-host-seat [data-input-scroll]{margin:0!important}
.nb-host-seat [data-input-scroll]>div{padding:0!important}
.nb-host-seat [data-composer-input]{font-size:14px!important;line-height:22px!important;min-height:22px!important;min-width:0;overflow-wrap:anywhere;padding:0!important}
.nb-host-seat [data-composer-input] p{margin:0!important}
.nb-host-seat [data-composer-placeholder]{font-size:14px!important;line-height:22px!important;padding:0!important;inset:0 0 auto!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.nb-composer-controls{position:absolute;inset:0;pointer-events:none}
.nb-host-seat:has([data-nb-composer-mode=tools]) .nb-composer-controls{position:relative;inset:auto}
.nb-board-tools{display:flex;align-items:center;gap:4px;padding:6px 8px;height:44px;width:max-content;pointer-events:auto;background:var(--nb-surface);border:1px solid var(--nb-border);border-radius:8px;box-shadow:0 3px 16px #00000014}
.nb-board-tools .nb-rule{margin:0 4px}
.nb-ai-dot{position:absolute;right:1px;top:2px;width:6px;height:6px;border-radius:50%;background:var(--nb-accent)}.nb-ai-dot.is-error{background:var(--dsw-alias-state-error-primary,#bc3c4b)}
.nb-ai-busy{position:absolute;right:-1px;top:0;background:var(--nb-surface);color:var(--nb-accent);animation:nb-spin 1s linear infinite}@keyframes nb-spin{to{transform:rotate(360deg)}}
.nb-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
.nb-input-actions{position:absolute;left:8px;right:8px;bottom:8px;display:flex;justify-content:space-between;align-items:center;height:32px;pointer-events:none}
.nb-input-actions .nb-icon{pointer-events:auto}.nb-input-trailing{display:flex;gap:4px;align-items:center}
.nb-input-trailing .nb-icon:last-child{background:var(--nb-accent);color:#fff}.nb-input-trailing .nb-icon:last-child:disabled{background:var(--nb-hover);color:var(--nb-muted)}
.nb-input-status,.nb-reply-toast{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:min(560px,var(--nb-available-width,560px));box-sizing:border-box;background:var(--nb-surface);border:1px solid var(--nb-border);border-radius:8px;box-shadow:var(--nb-shadow);padding:10px 12px;pointer-events:auto;font-size:13px;overflow-wrap:anywhere}
.nb-input-status{color:var(--dsw-alias-state-error-primary,#bc3c4b);max-height:120px;overflow:auto}
.nb-reply-toast p{margin:0;line-height:20px;white-space:pre-wrap;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.nb-reply-actions{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.nb-reply-actions>button:first-child{border:0;background:transparent;padding:4px 0;color:var(--nb-accent);font-size:12px}.nb-reply-actions .nb-icon{height:24px;width:24px}
.nb-reference-dock{position:relative;pointer-events:auto;min-width:0;padding:0 12px;color:var(--nb-text)}
.nb-reference-strip{display:flex;align-items:center;gap:4px;min-width:0}.nb-reference-strip>.nb-icon{width:24px;height:30px;background:var(--nb-surface)}
.nb-reference-rail{position:relative;display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;padding:2px 0}.nb-reference-rail::-webkit-scrollbar{display:none}
.nb-reference-chip{display:flex;align-items:center;flex-shrink:0;height:30px;max-width:100%;border-radius:6px;background:var(--nb-note);color:var(--nb-ink);border:1px solid color-mix(in srgb,var(--nb-ink) 12%,transparent)}
.nb-reference-name{display:block!important;min-width:0;max-width:160px;height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:none;padding:0 9px;font-size:12px!important;text-align:left;border-radius:5px}
.nb-reference-name:hover{background:color-mix(in srgb,var(--nb-ink) 7%,transparent)}.nb-reference-chip .nb-icon{width:26px;height:26px;margin-right:1px}.nb-reference-chip .nb-icon svg{width:13px;height:13px}.nb-reference-chip button:focus-visible{outline-offset:-2px}
.nb-reference-error{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-state-error-primary,#bc3c4b);background:var(--nb-surface);border-radius:6px;padding:4px 8px;margin-top:4px}.nb-reference-error span{flex:1;overflow-wrap:anywhere}
.nb-reference-preview{padding:16px;max-height:65vh;overflow:auto}.nb-reference-preview h3{margin-top:0;overflow-wrap:anywhere}
@media(max-width:500px){.nb-board-tools{gap:2px;padding:5px}.nb-board-tools .nb-rule{margin:0 2px}}
@media(prefers-reduced-motion:reduce){.nb-pulse,.nb-ai-busy{animation:none}.nb-host-seat{transition:none}}
`
