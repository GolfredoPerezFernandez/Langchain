import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainTable,
} from "~/components/legalchain/ui";
import {
  getCurrentLegalchainUser,
  getLegalchainTemplateBySlug,
  listLegalchainTemplates,
  type LegalchainTemplateRecord,
} from "~/lib/legalchain/store";

export const useTemplateDetailLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const [template, templates] = await Promise.all([
    getLegalchainTemplateBySlug(event.params.name),
    listLegalchainTemplates(),
  ]);
  if (!template) {
    throw event.redirect(302, "/templates");
  }

  return {
    user,
    template,
    relatedTemplates: templates
      .filter((item: LegalchainTemplateRecord) => item.slug !== template.slug)
      .slice(0, 3),
  };
});

export default component$(() => {
  const { template, relatedTemplates } = useTemplateDetailLoader().value;

  return (
    <LegalchainPageShell
      eyebrow="Template detail"
      title={template.title}
      description="This view now behaves like a real working screen: script blocks, operator checkpoints, rollout metadata and a direct jump into recording."
      actions={[
        { label: "Back to templates", href: "/templates" },
        { label: "Record with this template", href: "/record" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Category", value: template.category, hint: "Template group in the library." },
          { label: "Duration", value: template.duration, hint: "Designed capture length." },
          { label: "Version", value: template.version, hint: "Current working revision." },
          { label: "Uses", value: template.uses, hint: "Recorded sessions using this flow." },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div class="space-y-6">
          <LegalchainPanel
            eyebrow="Script blocks"
            title="Structured capture copy"
            description="The content stack mirrors the original app: short legal blocks, no over-designed editor chrome and immediate context for recording."
          >
            <div class="space-y-4">
              {template.scriptBlocks.map((block, index) => (
                <div key={block.title} class="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-base font-black text-white">
                      {index + 1}. {block.title}
                    </div>
                    <LegalchainPill label={template.status} tone={template.status === "Published" ? "success" : "warning"} />
                  </div>
                  <p class="mt-3 text-sm leading-7 text-white/66">{block.copy}</p>
                </div>
              ))}
            </div>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Version log" title="Recent changes">
            <LegalchainTable
              columns={["Revision", "Owner", "Change"]}
              rows={[
                [template.version, "Admin", "UI aligned to the Qwik workspace layout"],
                ["v2.3", "Ops", "Capture flow compressed for faster playback review"],
                ["v2.2", "Legal", "Consent and delivery language updated"],
              ]}
            />
          </LegalchainPanel>
        </div>

        <div class="space-y-6">
          <LegalchainPanel eyebrow="Operator checklist" title="What must remain clear">
            <LegalchainChecklist
              items={template.checkpoints.map((checkpoint) => ({
                title: checkpoint.split(".")[0],
                text: checkpoint,
              }))}
            />
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Related templates" title="Recommended neighbors">
            <div class="space-y-3">
              {relatedTemplates.map((item: LegalchainTemplateRecord) => (
                <a
                  key={item.slug}
                  href={`/templates/${item.slug}`}
                  class="block rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-white/76 transition hover:bg-white/[0.08]"
                >
                  <div class="font-black text-white">{item.title}</div>
                  <div class="mt-2 leading-6 text-white/60">{item.summary}</div>
                </a>
              ))}
            </div>
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});
