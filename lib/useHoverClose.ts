import { useEffect, useRef } from 'react';

/**
 * 鼠标从触发元素移到面板时会先触发 mouseleave。这里用一个很短的延迟关闭，
 * 面板自身的 mouseenter 会取消它。
 */
export function useHoverClose() {
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const schedule = (close: () => void) => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      close();
    }, 160);
  };

  useEffect(() => cancel, []);

  return { cancel, schedule };
}
