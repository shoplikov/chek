"use client";
import { useEffect, useState } from "react";

/** Re-reads localStorage-backed values whenever the store changes. Undefined until mounted. */
export function useStoreValue<T>(read: () => T): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => {
    const update = () => setV(read());
    update();
    window.addEventListener("chek-store", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("chek-store", update); window.removeEventListener("storage", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}
