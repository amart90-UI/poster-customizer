import { useToasts } from "@/store/toasts";

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.variant}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
