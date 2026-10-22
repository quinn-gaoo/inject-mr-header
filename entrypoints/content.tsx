import ReactDOM from 'react-dom/client';
import tippyBaseCss from 'tippy.js/dist/tippy.css?inline';
import { PagePanel } from '@/components/PagePanel';
import panelCss from '@/styles/page-panel.css?inline';
import tippyThemeCss from '@/styles/tippy-theme.css?inline';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main(ctx) {
    if (!(document.documentElement instanceof HTMLElement)) return;

    const host = document.createElement('div');
    host.setAttribute('data-mrh-root', '');
    host.style.cssText =
      'all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483000; width: 24px; height: 24px; display: none;';

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = panelCss;
    shadow.appendChild(style);

    const container = document.createElement('div');
    shadow.appendChild(container);
    document.documentElement.appendChild(host);

    // Tippy.js 的 tooltip 会挂到页面 body 上，这里为它注入全局样式
    const tippyStyle = document.createElement('style');
    tippyStyle.setAttribute('data-mrh-tippy-style', '');
    tippyStyle.textContent = `${tippyBaseCss}\n${tippyThemeCss}`;
    (document.head ?? document.documentElement).appendChild(tippyStyle);

    const root = ReactDOM.createRoot(container);
    root.render(<PagePanel host={host} />);

    ctx.onInvalidated(() => {
      root.unmount();
      host.remove();
      tippyStyle.remove();
    });
  },
});
