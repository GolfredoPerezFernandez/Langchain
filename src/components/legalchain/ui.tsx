import { Slot, component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

type PillTone = "default" | "light" | "success" | "warning" | "danger";

export type LegalchainTableCell =
  | string
  | {
      label: string;
      tone?: PillTone;
      meta?: string;
    };

export const LegalchainPanel = component$<{
  title?: string;
  eyebrow?: string;
  description?: string;
  dense?: boolean;
}>(({ title, eyebrow, description, dense }) => {
  return (
    <article
      class={[
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,10,37,0.94),rgba(16,8,23,0.9))] shadow-[0_26px_90px_rgba(8,3,18,0.38)] backdrop-blur",
        dense ? "p-4" : "p-6",
      ]}
    >
      {(eyebrow || title || description) && (
        <div class="mb-5">
          {eyebrow && (
            <div class="text-[10px] font-black uppercase tracking-[0.3em] text-white/46">{eyebrow}</div>
          )}
          {title && <h2 class="mt-2 text-xl font-black tracking-tight text-white">{title}</h2>}
          {description && <p class="mt-2 text-sm leading-7 text-white/64">{description}</p>}
        </div>
      )}
      <Slot />
    </article>
  );
});

export const LegalchainPill = component$<{ label: string; tone?: PillTone }>(({ label, tone }) => {
  const tones: Record<PillTone, string> = {
    default: "bg-white/10 text-white/72",
    light: "bg-white text-[#7e0f84]",
    success: "bg-emerald-400/16 text-emerald-200",
    warning: "bg-amber-400/16 text-amber-100",
    danger: "bg-rose-400/16 text-rose-100",
  };

  return (
    <span
      class={[
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]",
        tones[tone ?? "default"],
      ]}
    >
      {label}
    </span>
  );
});

export const LegalchainStatGrid = component$<{
  items: { label: string; value: string; hint?: string }[];
}>(({ items }) => {
  return (
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          class="rounded-[24px] border border-white/8 bg-[#13071d]/84 p-5 shadow-[0_18px_50px_rgba(9,3,20,0.35)]"
        >
          <div class="text-[11px] uppercase tracking-[0.28em] text-white/42">{item.label}</div>
          <div class="mt-3 text-3xl font-black tracking-tight text-white">{item.value}</div>
          {item.hint && <div class="mt-2 text-sm leading-6 text-white/58">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
});

export const LegalchainChecklist = component$<{
  items: { title: string; text: string }[];
}>(({ items }) => {
  return (
    <div class="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.title}
          class="flex gap-3 rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4"
        >
          <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#7e0f84]">
            {index + 1}
          </div>
          <div>
            <div class="text-sm font-black text-white">{item.title}</div>
            <p class="mt-1 text-sm leading-6 text-white/62">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
});

export const LegalchainActionCard = component$<{
  title: string;
  text: string;
  href: string;
  meta?: string;
}>(({ title, text, href, meta }) => {
  return (
    <Link
      href={href}
      class="group rounded-[24px] border border-white/10 bg-white/[0.05] p-5 transition hover:-translate-y-1 hover:bg-white/[0.08]"
    >
      {meta && <div class="text-[10px] font-black uppercase tracking-[0.28em] text-white/42">{meta}</div>}
      <h3 class="mt-2 text-lg font-black tracking-tight text-white">{title}</h3>
      <p class="mt-2 text-sm leading-7 text-white/64">{text}</p>
      <div class="mt-4 text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Open</div>
    </Link>
  );
});

export const LegalchainValueList = component$<{
  items: { label: string; value: string; tone?: PillTone }[];
}>(({ items }) => {
  return (
    <div class="space-y-3">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          class="flex items-start justify-between gap-4 rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3"
        >
          <div class="text-[11px] font-black uppercase tracking-[0.22em] text-white/42">{item.label}</div>
          <div class="text-right text-sm text-white">
            {item.tone ? <LegalchainPill label={item.value} tone={item.tone} /> : item.value}
          </div>
        </div>
      ))}
    </div>
  );
});

export const LegalchainSearchBox = component$<{ placeholder: string; detail?: string }>(({ placeholder, detail }) => {
  return (
    <div class="rounded-[22px] border border-white/10 bg-[#0d0713]/88 px-4 py-4">
      <div class="text-sm text-white/45">{placeholder}</div>
      {detail && <div class="mt-2 text-xs uppercase tracking-[0.24em] text-white/34">{detail}</div>}
    </div>
  );
});

export const LegalchainTable = component$<{
  columns: string[];
  rows: LegalchainTableCell[][];
}>(({ columns, rows }) => {
  const renderCell = (cell: LegalchainTableCell) => {
    if (typeof cell === "string") {
      return cell;
    }

    if (cell.tone) {
      return <LegalchainPill label={cell.label} tone={cell.tone} />;
    }

    return (
      <div>
        <div>{cell.label}</div>
        {cell.meta && <div class="mt-1 text-xs uppercase tracking-[0.2em] text-white/35">{cell.meta}</div>}
      </div>
    );
  };

  return (
    <div class="overflow-hidden rounded-[24px] border border-white/8">
      <div class="grid bg-white/10" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <div key={column} class="px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
            {column}
          </div>
        ))}
      </div>
      <div class="divide-y divide-white/8 bg-[#13071d]/72">
        {rows.map((row, rowIndex) => (
          <div
            key={`${rowIndex}-${typeof row[0] === "string" ? row[0] : row[0].label}`}
            class="grid"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {row.map((cell, cellIndex) => (
              <div key={`${rowIndex}-${cellIndex}`} class="px-4 py-4 text-sm text-white/72">
                {renderCell(cell)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
