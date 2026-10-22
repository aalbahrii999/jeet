import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { asset } from "./logic";
import { Dumbbell, X, type IconName, Icon } from "./icons";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "flame" | "quiet" };
export function Btn({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) { return <button type={type} className={`btn btn-${variant} ${className}`} {...props} />; }
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`app-card ${className}`}>{children}</section>; }
export function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) { return <header className="page-heading"><div>{eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}<h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</header>; }
export function EmptyState({ icon = "Dumbbell", title, text, children }: { icon?: IconName; title: string; text: string; children?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={30} /></span><h3>{title}</h3><p>{text}</p>{children}</div>; }
export function Pill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "orange" | "blue" | "muted" }) { return <span className={`pill pill-${tone}`}>{children}</span>; }
export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: () => void; description?: string }) { const id = useId(); return <div className="toggle-row"><div><label id={id}>{label}</label>{description ? <p>{description}</p> : null}</div><button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className={`toggle ${checked ? "is-on" : ""}`} onClick={onChange}><span /></button></div>; }
export function MachinePhoto({ image, photos, alt }: { image: string; photos: Record<string, string>; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = photos[image] || (image ? asset(`machines/${image}.jpg`) : "");
  return src && failed !== src ? <img src={src} alt={alt} loading="lazy" className="machine-photo" onError={() => setFailed(src)} /> : <div className="machine-placeholder"><Dumbbell size={60} /><span>{alt}</span></div>;
}
export function Field({ label, value, onChange, step = "1", max = 2000, placeholder = "—" }: { label: string; value: number | null; onChange: (value: number | null) => void; step?: string; max?: number; placeholder?: string }) {
  const id = useId(), delta = Number(step) || 1;
  const change = (number: number) => onChange(Math.min(max, Math.max(0, Math.round(number * 100) / 100)));
  return <div className="number-field"><label htmlFor={id}>{label}</label><div className="number-control" dir="ltr"><button type="button" onClick={() => change((value ?? 0) - delta)} aria-label={`أنقص ${label}`}>−</button><input id={id} type="number" min="0" max={max} step={step} inputMode={delta < 1 ? "decimal" : "numeric"} value={value ?? ""} placeholder={placeholder} onChange={(event) => { const text = event.target.value; if (text === "") onChange(null); else if (Number.isFinite(Number(text))) change(Number(text)); }} /><button type="button" onClick={() => change((value ?? 0) + delta)} aria-label={`زد ${label}`}>+</button></div></div>;
}
export function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), titleId = useId(), descId = useId(), closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,button,select,textarea,[tabindex='0']")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex='0']") ?? [])].filter((node) => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const back = (event: Event) => { event.preventDefault(); closeRef.current(); };
    document.addEventListener("keydown", key); window.addEventListener("jeet:back", back);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); window.removeEventListener("jeet:back", back); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} className={`modal-panel ${wide ? "modal-wide" : ""}`}><header className="modal-heading"><div><h2 id={titleId}>{title}</h2>{description ? <p id={descId}>{description}</p> : null}</div><button className="icon-button" aria-label="إغلاق" onClick={onClose}><X /></button></header><div className="modal-body">{children}</div></div></div>;
}
export function Confirm({ title, text, action, onConfirm, onClose, danger = false }: { title: string; text: string; action: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) { return <Modal title={title} description={text} onClose={onClose}><div className="button-row"><Btn variant={danger ? "flame" : "primary"} onClick={onConfirm}>{action}</Btn><Btn variant="ghost" onClick={onClose}>تراجع</Btn></div></Modal>; }
