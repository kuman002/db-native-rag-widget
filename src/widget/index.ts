import { ChatWidget, type ChatWidgetConfig } from './widget.js';

export * from './widget.js';
export * from './styles.js';
export * from './sanitizer.js';
export * from './stream.js';

declare global {
  interface Window {
    RagWidget?: {
      instance?: ChatWidget;
      init: (config: ChatWidgetConfig) => ChatWidget;
      open: () => void;
      close: () => void;
      toggle: () => void;
    };
  }
}

function autoInit(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Search for the current script tag
  const currentScript =
    document.currentScript ||
    document.querySelector('script[data-tenant-key]') ||
    document.querySelector('script[src*="widget.js"]');

  const config: ChatWidgetConfig = {
    tenantKey: currentScript?.getAttribute('data-tenant-key') || 'default_tenant',
    apiBase: currentScript?.getAttribute('data-api-base') || '',
    primaryColor: currentScript?.getAttribute('data-primary-color') || undefined,
    position: (currentScript?.getAttribute('data-position') as any) || undefined,
    greeting: currentScript?.getAttribute('data-greeting') || undefined,
    title: currentScript?.getAttribute('data-title') || undefined,
  };

  const widget = new ChatWidget(config);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => widget.init());
  } else {
    widget.init();
  }

  // Global window handle for developer control
  window.RagWidget = {
    instance: widget,
    init: (customConfig: ChatWidgetConfig) => {
      const customWidget = new ChatWidget(customConfig);
      customWidget.init();
      return customWidget;
    },
    open: () => widget.toggle(true),
    close: () => widget.toggle(false),
    toggle: () => widget.toggle(),
  };
}

// Auto-run when included via <script> tag
autoInit();

