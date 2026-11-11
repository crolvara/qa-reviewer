"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button and initial focus on Cancel, for actions that lose data. */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * In-app replacement for window.confirm(). Returns `confirm(opts) => Promise<boolean>`
 * plus the dialog element to render once. Uses native <dialog>.showModal() so focus
 * trapping, Esc and the top layer come from the browser.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          prev?.resolve(false); // a second request cancels the first
          return { ...opts, resolve };
        });
      }),
    [],
  );

  const settle = useCallback((ok: boolean) => {
    setPending((prev) => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  const dialog = pending ? <ConfirmDialog {...pending} onSettle={settle} /> : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onSettle,
}: ConfirmOptions & { onSettle: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    if (!el.open) el.showModal();
    (destructive ? cancelRef : confirmRef).current?.focus();
    return () => {
      if (el.open) el.close();
      returnFocus?.focus?.();
    };
  }, [destructive]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={message ? descId : undefined}
      // Esc fires "cancel"; prevent the default close so React state stays the source of truth.
      onCancel={(e) => {
        e.preventDefault();
        onSettle(false);
      }}
      // Click on the backdrop (the dialog element itself, outside the panel) cancels.
      onClick={(e) => {
        if (e.target === e.currentTarget) onSettle(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white p-0 text-slate-900 shadow-xl ring-1 ring-slate-200 backdrop:bg-slate-900/40 backdrop:backdrop-blur-[1px]"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {message && (
          <p id={descId} className="mt-1.5 text-sm leading-6 text-slate-600">
            {message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${
              destructive
                ? "bg-red-700 hover:bg-red-800 focus-visible:outline-red-700"
                : "bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
