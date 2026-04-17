import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainTable,
} from "~/components/legalchain/ui";
import {
  getCurrentLegalchainUser,
  listLegalchainTemplateCategories,
  listLegalchainTemplates,
  type LegalchainTemplateRecord,
} from "~/lib/legalchain/store";

export const useTemplatesLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const query = event.url.searchParams.get("q") ?? "";
  const status = event.url.searchParams.get("status") ?? "";
  const category = event.url.searchParams.get("category") ?? "";
  const [templates, categories] = await Promise.all([
    listLegalchainTemplates({ query, status, category }),
    listLegalchainTemplateCategories(),
  ]);

  return { user, templates, filters: { query, status, category }, categories };
});

export default component$(() => {
  const { templates, filters, categories } = useTemplatesLoader().value;
  const templateRows: LegalchainTemplateRecord[] = templates;
  const categoryRows = categories as string[];
  const publishedCount = templateRows.filter((template: LegalchainTemplateRecord) => template.status === "Published").length;
  const reviewCount = templateRows.filter((template: LegalchainTemplateRecord) => template.status === "Review").length;
  const draftCount = templateRows.filter((template: LegalchainTemplateRecord) => template.status === "Draft").length;
  const mostUsedTemplate = [...templateRows].sort(
    (left: LegalchainTemplateRecord, right: LegalchainTemplateRecord) => Number(right.uses) - Number(left.uses),
  )[0];

  return (
    <LegalchainPageShell
      eyebrow="Private route"
      title="Templates"
      description="The Qwik library now mirrors the original Legalchain screen: searchable cards, clear status, category context and direct jumps into recording."
      actions={[
        { label: "Control panel", href: "/controlPanel" },
        { label: "Start record", href: "/record" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Published", value: `${publishedCount}`.padStart(2, "0"), hint: "Available for immediate capture." },
          { label: "Review", value: `${reviewCount}`.padStart(2, "0"), hint: "Waiting legal or ops approval." },
          { label: "Draft", value: `${draftCount}`.padStart(2, "0"), hint: "Visible only to admins." },
          {
            label: "Most used",
            value: mostUsedTemplate?.title.split(" ")[0] || "Proof",
            hint: "The highest traffic evidence template.",
          },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <LegalchainPanel
          eyebrow="Library controls"
          title="Search and filtering"
          description="The old React flow used search plus lightweight categorization. The Qwik version now filters the live Turso catalog, not placeholder cards."
        >
          <form method="get" class="space-y-4">
            <label class="block">
              <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Search</div>
              <input
                name="q"
                value={filters.query}
                placeholder="Title, category, audience or summary"
                class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Status</div>
                <select
                  name="status"
                  class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="" selected={!filters.status}>All statuses</option>
                  {["Published", "Review", "Draft"].map((status) => (
                    <option key={status} value={status} selected={filters.status === status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Category</div>
                <select
                  name="category"
                  class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="" selected={!filters.category}>All categories</option>
                  {categoryRows.map((category: string) => (
                    <option key={category} value={category} selected={filters.category === category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="submit"
                class="rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                Apply filters
              </button>
              <Link
                href="/templates"
                class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white"
              >
                Reset
              </Link>
            </div>

            <div class="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Current focus</div>
              <div class="mt-3 flex flex-wrap gap-2">
                <LegalchainPill label={filters.category || "All categories"} tone="light" />
                <LegalchainPill label={filters.status || "All statuses"} />
                <LegalchainPill label={`${templateRows.length} results`} />
              </div>
            </div>
          </form>
        </LegalchainPanel>

        <div class="grid gap-4 md:grid-cols-2">
          {templateRows.map((template: LegalchainTemplateRecord) => (
            <Link
              key={template.slug}
              href={`/templates/${template.slug}`}
              class="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,10,35,0.95),rgba(17,9,24,0.9))] p-6 shadow-[0_22px_80px_rgba(12,5,24,0.32)] transition hover:-translate-y-1 hover:bg-white/[0.08]"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="text-[10px] uppercase tracking-[0.28em] text-white/42">{template.category}</div>
                  <h2 class="mt-2 text-xl font-black text-white">{template.title}</h2>
                </div>
                <LegalchainPill
                  label={template.status}
                  tone={
                    template.status === "Published"
                      ? "success"
                      : template.status === "Review"
                        ? "warning"
                        : "default"
                  }
                />
              </div>
              <p class="mt-3 text-sm leading-7 text-white/66">{template.summary}</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <div>
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/34">Duration</div>
                  <div class="mt-1 text-sm text-white/78">{template.duration}</div>
                </div>
                <div>
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/34">Uses</div>
                  <div class="mt-1 text-sm text-white/78">{template.uses}</div>
                </div>
                <div>
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/34">Version</div>
                  <div class="mt-1 text-sm text-white/78">{template.version}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <LegalchainPanel eyebrow="Library ledger" title="Template rollout">
        <LegalchainTable
          columns={["Template", "Audience", "Status", "Version"]}
          rows={templateRows.map((template: LegalchainTemplateRecord) => [
            template.title,
            template.audience,
            {
              label: template.status,
              tone:
                template.status === "Published"
                  ? "success"
                  : template.status === "Review"
                    ? "warning"
                    : "default",
            },
            template.version,
          ])}
        />
      </LegalchainPanel>
    </LegalchainPageShell>
  );
});
