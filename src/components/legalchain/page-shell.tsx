import { Slot, component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { LegalchainPill } from "./ui";

export const LegalchainPageShell = component$<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: { label: string; href: string }[];
}>(({ eyebrow, title, description, actions }) => {
  return (
    <section class="space-y-6">
      <div class="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(33,11,44,0.98),rgba(18,9,27,0.95))] p-6 shadow-[0_28px_90px_rgba(11,6,24,0.35)] backdrop-blur">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-3xl">
            <div class="text-[11px] uppercase tracking-[0.32em] text-white/55">{eyebrow}</div>
            <h1 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
            <p class="mt-3 text-sm leading-7 text-white/72 sm:text-base">{description}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <LegalchainPill label="UI ready" tone="light" />
            <LegalchainPill label="Qwik workspace" />
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div class="mt-5 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                class="rounded-full border border-white/12 bg-white/[0.09] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.15]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Slot />
    </section>
  );
});
