import { component$ } from "@builder.io/qwik";

export const LegalchainLogo = component$<{ compact?: boolean }>(({ compact }) => {
  return (
    <div class="flex items-center gap-3">
      <div class="relative grid h-12 w-12 place-items-center overflow-hidden rounded-[18px] border border-white/15 bg-[linear-gradient(145deg,#a71fb0_0%,#65116f_52%,#24072b_100%)] shadow-[0_18px_45px_rgba(9,4,20,0.4)]">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_42%)]" />
        <div class="absolute inset-x-2 bottom-2 h-px bg-white/20" />
        <div class="relative text-sm font-black uppercase tracking-[0.28em] text-white">LC</div>
      </div>
      {!compact && (
        <div class="flex flex-col">
          <div class="text-sm font-black uppercase tracking-[0.42em] text-white sm:text-base">
            Legalchain
          </div>
          <span class="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/55 sm:text-[11px]">
            Trust your record
          </span>
        </div>
      )}
    </div>
  );
});
