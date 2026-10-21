import ReactDOM from 'react-dom/client';
import { PagePanel } from '@/components/PagePanel';
import panelCss from '@/styles/page-panel.css?inline';
import popoverCss from '@/styles/page-popover.css?inline';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main(ctx) {
    if (!(document.documentElement instanceof HTMLElement)) return;

    const host = document.createElement('div');
    host.setAttribute('data-mrh-root', '');
    host.style.cssText =
      'all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483000; width: 30px; height: 30px; display: none;';

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = panelCss;
    shadow.appendChild(style);

    const container = document.createElement('div');
    shadow.appendChild(container);
    document.documentElement.appendChild(host);

    // Headless UI 的 Popover 面板会 portal 到 body，这里为它注入独立样式
    const popoverStyle = document.createElement('style');
    popoverStyle.setAttribute('data-mrh-popover-style', '');
    popoverStyle.textContent = popoverCss;
    (document.head ?? document.documentElement).appendChild(popoverStyle);

    const root = ReactDOM.createRoot(container);
    root.render(<PagePanel host={host} />);

    ctx.onInvalidated(() => {
      root.unmount();
      host.remove();
      popoverStyle.remove();
    });
  },
});
