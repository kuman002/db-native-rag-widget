import { getWidgetStyles } from './styles.js';
import { renderSimpleMarkdown, escapeHtml } from './sanitizer.js';
import { fetchSseStream } from './stream.js';
import type { SseEvent } from '../query/types.js';

export interface ChatWidgetConfig {
  tenantKey: string;
  apiBase?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  greeting?: string;
  title?: string;
}

export class ChatWidget {
  private readonly config: Required<ChatWidgetConfig>;
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private conversationId: string;
  private isOpen = false;
  private isGenerating = false;

  constructor(config: ChatWidgetConfig) {
    this.config = {
      tenantKey: config.tenantKey || 'default_tenant',
      apiBase: config.apiBase || '',
      primaryColor: config.primaryColor || '#2563eb',
      position: config.position || 'bottom-right',
      greeting: config.greeting || 'Hi! How can I assist you with our products today?',
      title: config.title || 'Support Assistant',
    };

    // Restore or generate conversation ID from sessionStorage
    const storageKey = `rag_conv_${this.config.tenantKey}`;
    const savedId = typeof window !== 'undefined' ? window.sessionStorage?.getItem(storageKey) : null;
    this.conversationId = savedId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(storageKey, this.conversationId);
    }
  }

  public init(): void {
    if (typeof document === 'undefined') return;
    if (this.hostElement) return;

    this.hostElement = document.createElement('div');
    this.hostElement.id = 'db-native-rag-widget-root';
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    // Styles
    const styleEl = document.createElement('style');
    styleEl.textContent = getWidgetStyles();
    this.shadowRoot.appendChild(styleEl);

    // Apply custom theming
    if (this.config.primaryColor) {
      this.hostElement.style.setProperty('--rag-primary', this.config.primaryColor);
    }

    // Container
    const container = document.createElement('div');
    container.innerHTML = `
      <button class="rag-launcher" aria-label="Open chat widget">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>

      <div class="rag-window" role="dialog" aria-modal="true" aria-label="Chat window">
        <div class="rag-header">
          <div class="rag-header-left">
            <div class="rag-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            </div>
            <div>
              <div class="rag-header-title">${escapeHtml(this.config.title)}</div>
              <div class="rag-header-status"><span class="rag-status-dot"></span> Live verified database</div>
            </div>
          </div>
          <button class="rag-close-btn" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="rag-messages" id="rag-msg-list"></div>

        <div class="rag-footer">
          <div class="rag-input-box">
            <textarea class="rag-textarea" placeholder="Ask a question..." rows="1"></textarea>
            <button class="rag-send-btn" aria-label="Send inquiry">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div class="rag-brand-tag">Powered by DB-Native RAG</div>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(container);
    document.body.appendChild(this.hostElement);

    this.bindEvents();
    this.addBotMessage(this.config.greeting);
  }

  private bindEvents(): void {
    if (!this.shadowRoot) return;

    const launcher = this.shadowRoot.querySelector('.rag-launcher');
    const closeBtn = this.shadowRoot.querySelector('.rag-close-btn');
    const sendBtn = this.shadowRoot.querySelector('.rag-send-btn');
    const textarea = this.shadowRoot.querySelector('.rag-textarea') as HTMLTextAreaElement;

    launcher?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.toggle(false));

    sendBtn?.addEventListener('click', () => this.handleSend());
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  public toggle(forceState?: boolean): void {
    if (!this.shadowRoot) return;
    const windowEl = this.shadowRoot.querySelector('.rag-window');
    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;

    if (this.isOpen) {
      windowEl?.classList.add('rag-open');
      const textarea = this.shadowRoot.querySelector('.rag-textarea') as HTMLTextAreaElement;
      setTimeout(() => textarea?.focus(), 150);
    } else {
      windowEl?.classList.remove('rag-open');
    }
  }

  private async handleSend(): Promise<void> {
    if (!this.shadowRoot || this.isGenerating) return;

    const textarea = this.shadowRoot.querySelector('.rag-textarea') as HTMLTextAreaElement;
    const sendBtn = this.shadowRoot.querySelector('.rag-send-btn') as HTMLButtonElement;
    const text = textarea?.value?.trim();

    if (!text) return;

    textarea.value = '';
    this.addUserMessage(text);

    // Bot placeholder with typing dots
    const botMsgEl = this.createBotMessagePlaceholder();
    this.isGenerating = true;
    sendBtn.disabled = true;

    let accumulatedText = '';
    let sourcesCount = 0;
    let sourceTables: string[] = [];

    const apiUrl = `${this.config.apiBase}/api/v1/chat/message`;

    await fetchSseStream({
      url: apiUrl,
      tenantKey: this.config.tenantKey,
      message: text,
      conversationId: this.conversationId,
      onEvent: (event: SseEvent) => {
        if (event.event === 'sources') {
          sourcesCount = event.count;
          sourceTables = event.tables || [];
        } else if (event.event === 'token') {
          accumulatedText += event.delta;
          this.updateBotMessageContent(botMsgEl, accumulatedText, false);
        } else if (event.event === 'done') {
          this.updateBotMessageContent(botMsgEl, accumulatedText, true, sourcesCount, sourceTables);
        } else if (event.event === 'error') {
          this.updateBotMessageContent(botMsgEl, `Error: ${event.message}`, true);
        }
      },
      onError: (err: Error) => {
        this.updateBotMessageContent(
          botMsgEl,
          'Sorry, unable to connect to the knowledge assistant. Please try again.',
          true
        );
      },
      onComplete: () => {
        this.isGenerating = false;
        sendBtn.disabled = false;
        textarea.focus();
      },
    });
  }

  private addUserMessage(text: string): void {
    if (!this.shadowRoot) return;
    const msgList = this.shadowRoot.querySelector('#rag-msg-list');
    const msgEl = document.createElement('div');
    msgEl.className = 'rag-msg rag-msg-user';
    msgEl.textContent = text;
    msgList?.appendChild(msgEl);
    this.scrollToBottom();
  }

  private addBotMessage(text: string): void {
    if (!this.shadowRoot) return;
    const msgList = this.shadowRoot.querySelector('#rag-msg-list');
    const msgEl = document.createElement('div');
    msgEl.className = 'rag-msg rag-msg-bot';
    msgEl.innerHTML = renderSimpleMarkdown(text);
    msgList?.appendChild(msgEl);
    this.scrollToBottom();
  }

  private createBotMessagePlaceholder(): HTMLElement {
    const msgList = this.shadowRoot?.querySelector('#rag-msg-list');
    const msgEl = document.createElement('div');
    msgEl.className = 'rag-msg rag-msg-bot';
    msgEl.innerHTML = `
      <div class="rag-typing-dots">
        <span class="rag-typing-dot"></span>
        <span class="rag-typing-dot"></span>
        <span class="rag-typing-dot"></span>
      </div>
    `;
    msgList?.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  private updateBotMessageContent(
    msgEl: HTMLElement,
    text: string,
    isComplete: boolean,
    sourcesCount = 0,
    sourceTables: string[] = []
  ): void {
    let html = renderSimpleMarkdown(text);

    if (isComplete && sourcesCount > 0) {
      const tablesList = sourceTables.length > 0 ? ` (${sourceTables.join(', ')})` : '';
      html += `
        <div>
          <span class="rag-sources-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Verified from ${sourcesCount} record${sourcesCount > 1 ? 's' : ''}${tablesList}
          </span>
        </div>
      `;
    }

    msgEl.innerHTML = html;
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (!this.shadowRoot) return;
    const msgList = this.shadowRoot.querySelector('#rag-msg-list');
    if (msgList) {
      msgList.scrollTop = msgList.scrollHeight;
    }
  }

  public destroy(): void {
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
      this.hostElement = null;
      this.shadowRoot = null;
    }
  }
}

