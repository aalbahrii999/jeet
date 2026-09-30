import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { asset } from "./logic";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "flame" | "quiet";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-teal text-fg",
  flame: "bg-flame text-bg",
  ghost: "bg-raised text-fg",
  quiet: "bg-transparent text-muted",
};

export function Btn({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-base font-medium transition active:scale-[0.98] disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-surface ${className}`}>{children}</section>;
}

export function MachinePhoto({ image, photos, alt }: { image: string; photos: Record<string, string>; alt: string }) {
  const [failed, setFailed] = useState(false);
  const src = photos[image] || asset(`machines/${image}.jpg`);
  if (failed) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-raised px-6 text-center text-muted">{alt}</div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[4/3] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function Field({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        inputMode="decimal"
        dir="ltr"
        step={step}
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? null : Number(next));
        }}
        className="h-12 rounded-xl border border-line bg-raised text-center text-base text-fg tabular-nums outline-none focus:border-teal"
      />
    </label>
  );
}
