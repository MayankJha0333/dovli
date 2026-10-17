import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);

export function Toasts() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    pushToast = (m) => {
      setMsg(m);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(null), 2600);
    };
  }, []);
  return (
    <div className="toast" role="status" aria-live="polite" hidden={!msg}>
      {msg}
    </div>
  );
}
