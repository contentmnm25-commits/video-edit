"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/components/ui";

const CloseContext = createContext<() => void>(() => {});

/** Close the surrounding modal from inside its content (e.g. after a successful save). */
export const useCloseModal = () => useContext(CloseContext);

export function Modal({
  trigger,
  title,
  description,
  children,
  wide,
  triggerClassName,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName ?? "btn-secondary"} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className={cx(
          "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-white p-0 shadow-2xl backdrop:bg-gray-900/40",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        {open && (
          <CloseContext.Provider value={() => setOpen(false)}>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
          </CloseContext.Provider>
        )}
      </dialog>
    </>
  );
}

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
}
