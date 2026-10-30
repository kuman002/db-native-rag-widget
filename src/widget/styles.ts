/**
 * Encapsulated CSS Stylesheet for Shadow DOM
 * Uses CSS Variables for seamless white-labeling and theming.
 */

export function getWidgetStyles(): string {
  return `
    :host {
      --rag-primary: #2563eb;
      --rag-primary-hover: #1d4ed8;
      --rag-bg: #ffffff;
      --rag-surface: #f8fafc;
      --rag-border: #e2e8f0;
      --rag-text-primary: #0f172a;
      --rag-text-secondary: #64748b;
      --rag-user-msg-bg: var(--rag-primary);
      --rag-user-msg-text: #ffffff;
      --rag-bot-msg-bg: #f1f5f9;
      --rag-bot-msg-text: #0f172a;
      --rag-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --rag-radius: 16px;
      --rag-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);

      font-family: var(--rag-font);
      font-size: 14px;
      line-height: 1.5;
      color: var(--rag-text-primary);
      box-sizing: border-box;
      z-index: 2147483647;
      position: fixed;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .rag-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--rag-primary);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.39);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
      z-index: 2147483647;
    }

    .rag-launcher:hover {
      transform: scale(1.08);
      background: var(--rag-primary-hover);
    }

    .rag-launcher svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
      transition: transform 0.2s ease;
    }

    .rag-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: var(--rag-bg);
      border-radius: var(--rag-radius);
      box-shadow: var(--rag-shadow);
      border: 1px solid var(--rag-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
    }

    .rag-window.rag-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    /* Header */
    .rag-header {
      background: var(--rag-primary);
      color: #ffffff;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rag-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rag-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rag-header-title {
      font-weight: 600;
      font-size: 15px;
    }

    .rag-header-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      opacity: 0.85;
    }

    .rag-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
    }

    .rag-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      opacity: 0.8;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rag-close-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }

    /* Message Area */
    .rag-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--rag-surface);
    }

    .rag-messages::-webkit-scrollbar {
      width: 5px;
    }

    .rag-messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .rag-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      word-break: break-word;
      font-size: 13.5px;
      line-height: 1.5;
    }

    .rag-msg-user {
      align-self: flex-end;
      background: var(--rag-user-msg-bg);
      color: var(--rag-user-msg-text);
      border-bottom-right-radius: 4px;
    }

    .rag-msg-bot {
      align-self: flex-start;
      background: var(--rag-bot-msg-bg);
      color: var(--rag-bot-msg-text);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--rag-border);
    }

    .rag-inline-code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
    }

    .rag-link {
      color: var(--rag-primary);
      text-decoration: underline;
      font-weight: 500;
    }

    /* Sources Pill */
    .rag-sources-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 12px;
      margin-top: 6px;
      font-weight: 500;
    }

    /* Typing Pulse Indicator */
    .rag-typing-dots {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
    }

    .rag-typing-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: rag-pulse 1.4s infinite ease-in-out both;
    }

    .rag-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .rag-typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes rag-pulse {
      0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Input Footer */
    .rag-footer {
      padding: 12px;
      background: var(--rag-bg);
      border-top: 1px solid var(--rag-border);
    }

    .rag-input-box {
      display: flex;
      align-items: center;
      background: var(--rag-surface);
      border: 1px solid var(--rag-border);
      border-radius: 24px;
      padding: 6px 8px 6px 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .rag-input-box:focus-within {
      border-color: var(--rag-primary);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    .rag-textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      resize: none;
      height: 22px;
      max-height: 80px;
      font-size: 13.5px;
      font-family: inherit;
      color: var(--rag-text-primary);
    }

    .rag-textarea::placeholder {
      color: var(--rag-text-secondary);
    }

    .rag-send-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--rag-primary);
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.1s ease;
    }

    .rag-send-btn:hover {
      background: var(--rag-primary-hover);
    }

    .rag-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rag-brand-tag {
      text-align: center;
      font-size: 10px;
      color: var(--rag-text-secondary);
      margin-top: 6px;
    }
  `;
}

