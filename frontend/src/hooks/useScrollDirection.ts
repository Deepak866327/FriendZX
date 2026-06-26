import { useState, useEffect } from 'react';

export function useScrollDirection(threshold = 8) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let rafId = 0;

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const y = window.scrollY;
        // Always show when at the very top
        if (y <= 4) { setHidden(false); lastY = y; return; }
        // Only update direction when movement exceeds threshold
        if (Math.abs(y - lastY) >= threshold) {
          setHidden(y > lastY);
          lastY = y;
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [threshold]);

  return hidden;
}
