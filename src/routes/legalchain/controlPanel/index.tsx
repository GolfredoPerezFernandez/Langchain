import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainTable,
} from "~/components/legalchain/ui";
import {
  createLegalchainTemplate,
  deleteLegalchainTemplate,
  getCurrentLegalchainUser,
  getLegalchainTemplateBySlug,
  getLegalchainWorkspace,
  updateLegalchainTemplate,
  type LegalchainPaymentRow,
  type LegalchainRecordRow,
  type LegalchainTemplateRecord,
} from "~/lib/legalchain/store";

type ControlPanelQueueItem = {
  title: string;
  note: string;
  priority: "High" | "Medium" | "Low";
};

const templateStatuses = ["Published", "Review", "Draft"];

const parseMultilineList = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseScriptBlocks = (value: string) =>
  parseMultilineList(value).map((line, index) => {
    const [title, ...rest] = line.split(":");
    const fallbackTitle = `Block ${index + 1}`;
    if (!rest.length) {
      return {
        title: fallbackTitle,
        copy: title.trim(),
      };
    }

    return {
      title: title.trim() || fallbackTitle,
      copy: rest.join(":").trim(),
    };
  });

const shortenAddress = (value?: string | null) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not available";

const buildControlPanelQueue = (input: {
  templates: LegalchainTemplateRecord[];
  records: LegalchainRecordRow[];
  payments: LegalchainPaymentRow[];
  draft: {
    title: string;
    templateTitle: string;
    updatedAt: string;
  } | null;
  collection: {
    name: string;
    address: string;
  } | null;
}) => {
  const items: ControlPanelQueueItem[] = [];

  if (input.draft) {
    items.push({
      title: "Review current draft",
      note: `${input.draft.title} is staged under ${input.draft.templateTitle} and was updated ${input.draft.updatedAt}.`,
      priority: "High",
    });
  }

  if (!input.collection && input.draft) {
    items.push({
      title: "Deploy first Base collection",
      note: "The next mint will deploy the user's custodial ERC-721 collection on Base before minting the evidence NFT.",
      priority: "High",
    });
  }

  for (const template of input.templates.filter((item) => item.status === "Review").slice(0, 2)) {
    items.push({
      title: `Publish template: ${template.title}`,
      note: `${template.category} flow is still in review and needs legal approval before operators can use it live.`,
      priority: "Medium",
    });
  }

  for (const record of input.records.filter((item) => item.status === "Review").slice(0, 2)) {
    items.push({
      title: `Review evidence: ${record.title}`,
      note: `Minted record ${record.hash} is waiting on operator review before it moves fully into the published archive.`,
      priority: "High",
    });
  }

  for (const payment of input.payments.filter((item) => item.status !== "Approved").slice(0, 2)) {
    items.push({
      title: `Resolve payment ${payment.reference}`,
      note: `${payment.flow} is ${payment.status.toLowerCase()} via ${payment.method} for ${payment.amount}.`,
      priority: payment.status === "Review" ? "Medium" : "High",
    });
  }

  if (!items.length && input.collection) {
    items.push({
      title: "Workspace synced",
      note: `${input.collection.name} is already deployed on Base and there are no review or treasury blockers in this workspace.`,
      priority: "Low",
    });
  }

  if (!items.length) {
    items.push({
      title: "Workspace ready",
      note: "No draft, payments or review items are pending yet. The next action is to record a new evidence asset.",
      priority: "Low",
    });
  }

  return items.slice(0, 6);
};

export const useControlPanelLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const workspace = await getLegalchainWorkspace(user.id);
  const queue = buildControlPanelQueue(workspace);
  const editSlug = event.url.searchParams.get("edit") ?? "";
  const editTemplate = editSlug ? await getLegalchainTemplateBySlug(editSlug) : workspace.templates[0] ?? null;

  return { user, workspace, queue, editTemplate };
});

export const useTemplateAdminAction = routeAction$(async (form) => {
  try {
    const intent = String(form.intent ?? "").trim();
    const title = String(form.title ?? "").trim();
    const category = String(form.category ?? "").trim();
    const duration = String(form.duration ?? "").trim();
    const status = String(form.status ?? "").trim();
    const version = String(form.version ?? "").trim();
    const summary = String(form.summary ?? "").trim();
    const audience = String(form.audience ?? "").trim();
    const slug = String(form.slug ?? "").trim();
    const scriptBlocks = parseScriptBlocks(String(form.scriptBlocks ?? ""));
    const checkpoints = parseMultilineList(String(form.checkpoints ?? ""));

    if (intent === "create") {
      const template = await createLegalchainTemplate({
        slug,
        title,
        category,
        duration,
        status,
        version,
        summary,
        audience,
        scriptBlocks,
        checkpoints,
      });

      return {
        ok: true,
        message: `Template ${template?.title || title} created.`,
      };
    }

    if (intent === "update") {
      const template = await updateLegalchainTemplate(slug, {
        title,
        category,
        duration,
        status,
        version,
        summary,
        audience,
        scriptBlocks,
        checkpoints,
      });

      return {
        ok: true,
        message: `Template ${template?.title || slug} updated.`,
      };
    }

    if (intent === "delete") {
      await deleteLegalchainTemplate(slug);
      return {
        ok: true,
        message: `Template ${slug} deleted.`,
      };
    }

    return {
      ok: false,
      error: "Unknown template action.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Template action failed.",
    };
  }
});

export default component$(() => {
  const { workspace, queue, editTemplate } = useControlPanelLoader().value;
  const templateAdminAction = useTemplateAdminAction();
  const { templates, records, payments, draft, collection, wallet } = workspace;
  const templateRows: LegalchainTemplateRecord[] = templates;
  const publishedCount = templateRows.filter((template: LegalchainTemplateRecord) => template.status === "Published").length;
  const templateReviewCount = templateRows.filter((template: LegalchainTemplateRecord) => template.status === "Review").length;
  const recordReviewCount = records.filter((record: LegalchainRecordRow) => record.status === "Review").length;
  const pendingPayments = payments.filter((payment: LegalchainPaymentRow) => payment.status !== "Approved").length;
  const reviewCount = templateReviewCount + recordReviewCount + pendingPayments;

  return (
    <LegalchainPageShell
      eyebrow="Private route"
      title="Control Panel"
      description="The admin route now runs on live workspace state: templates, draft evidence, Base collection status and treasury blockers all stay visible from the same control surface."
      actions={[
        { label: "Go to templates", href: "/templates" },
        { label: "Open record", href: "/record" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Templates", value: `${templates.length}`, hint: "Current flows available for recording and review." },
          {
            label: "Open queue",
            value: `${reviewCount}`.padStart(2, "0"),
            hint: "Combined template, record and payment items still waiting on action.",
          },
          {
            label: "Minted",
            value: `${records.length}`.padStart(2, "0"),
            hint: "Published evidence items already stored in the user's collection.",
          },
          {
            label: "Published",
            value: `${publishedCount}`.padStart(2, "0"),
            hint: "Templates already live for operators.",
          },
        ]}
      />

      {templateAdminAction.value && (
        <div
          class={[
            "rounded-[22px] border px-4 py-4 text-sm",
            templateAdminAction.value.ok
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              : "border-rose-400/20 bg-rose-400/10 text-rose-100",
          ]}
        >
          {templateAdminAction.value.ok ? templateAdminAction.value.message : templateAdminAction.value.error}
        </div>
      )}

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel
          eyebrow="Template methods"
          title="Admin workflow"
          description="The original route grouped add, delete and update inside a single control surface. That structure remains, but the UI now reflects the real workspace state behind those actions."
        >
          <div class="space-y-4">
            <div class="grid gap-3 md:grid-cols-3">
              <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Custodial wallet</div>
                <div class="mt-2 text-sm font-semibold text-white">{shortenAddress(wallet?.address)}</div>
                <div class="mt-2 text-xs leading-6 text-white/58">Server-managed signer used for Base deploy and mint flows.</div>
              </div>
              <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Collection</div>
                <div class="mt-2 text-sm font-semibold text-white">{collection?.name || "Not deployed"}</div>
                <div class="mt-2 text-xs leading-6 text-white/58">
                  {collection ? shortenAddress(collection.address) : "The first mint will deploy the user's ERC-721 collection on Base."}
                </div>
              </div>
              <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Current draft</div>
                <div class="mt-2 text-sm font-semibold text-white">{draft?.title || "No draft yet"}</div>
                <div class="mt-2 text-xs leading-6 text-white/58">
                  {draft ? `${draft.templateTitle} updated ${draft.updatedAt}.` : "Record a new asset to stage the next proof NFT."}
                </div>
              </div>
            </div>

            <details open class="group rounded-[24px] border border-white/8 bg-white/[0.05] px-5 py-4">
              <summary class="cursor-pointer list-none text-base font-black text-white">Add template</summary>
              <Form action={templateAdminAction} class="mt-4 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="intent" value="create" />

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Template title</div>
                  <input
                    name="title"
                    placeholder="Proof of Record"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Slug</div>
                  <input
                    name="slug"
                    placeholder="proof-of-record"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Category</div>
                  <input
                    name="category"
                    placeholder="Evidence"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Audience</div>
                  <input
                    name="audience"
                    placeholder="Operations and legal review"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Duration</div>
                  <input
                    name="duration"
                    placeholder="45-60 sec"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Status</div>
                  <select
                    name="status"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  >
                    {templateStatuses.map((status) => (
                      <option key={status} value={status} selected={status === "Draft"}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Version</div>
                  <input
                    name="version"
                    placeholder="v1.0"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block md:col-span-2">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Summary</div>
                  <textarea
                    name="summary"
                    rows={3}
                    placeholder="Short legal description for the template."
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block md:col-span-2">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Script blocks</div>
                  <textarea
                    name="scriptBlocks"
                    rows={4}
                    placeholder={"Identity: State full name and jurisdiction\nConsent: Confirm voluntary statement\nEvidence summary: Describe the event"}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block md:col-span-2">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Checkpoints</div>
                  <textarea
                    name="checkpoints"
                    rows={4}
                    placeholder={"Identity fields must be visible.\nConsent language cannot be edited.\nSummary must map to metadata."}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <div class="md:col-span-2">
                  <button
                    type="submit"
                    class="rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                  >
                    {templateAdminAction.isRunning ? "Saving..." : "Create template"}
                  </button>
                </div>
              </Form>
            </details>

            <details class="group rounded-[24px] border border-white/8 bg-white/[0.05] px-5 py-4">
              <summary class="cursor-pointer list-none text-base font-black text-white">Template list</summary>
              <div class="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                <div class="space-y-3">
                  {templateRows.length > 0 ? (
                    templateRows.map((template: LegalchainTemplateRecord) => (
                      <div
                        key={template.slug}
                        class="rounded-[20px] bg-[#12061a]/86 px-4 py-4"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div class="text-sm font-black text-white">{template.title}</div>
                            <div class="mt-1 text-xs uppercase tracking-[0.22em] text-white/38">
                              {template.category} / {template.version}
                            </div>
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

                        <p class="mt-2 text-sm leading-6 text-white/60">{template.summary}</p>

                        <div class="mt-4 flex flex-wrap gap-3">
                          <Link
                            href={`/controlPanel?edit=${template.slug}`}
                            class="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                          >
                            Edit
                          </Link>
                          <Form action={templateAdminAction}>
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="slug" value={template.slug} />
                            <button
                              type="submit"
                              class="rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-rose-100"
                            >
                              Delete
                            </button>
                          </Form>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div class="rounded-[20px] bg-[#12061a]/86 px-4 py-4 text-sm text-white/62">
                      No real templates found yet. Create one first to enable editing.
                    </div>
                  )}
                </div>

                <Form action={templateAdminAction} class="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="slug" value={editTemplate?.slug || ""} />
                  <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Edit surface</div>
                  <div class="mt-3 text-lg font-black text-white">{editTemplate?.title || "Select a template"}</div>
                  <div class="mt-4 grid gap-3">
                    <input
                      name="title"
                      value={editTemplate?.title || ""}
                      placeholder="Title"
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    />
                    <input
                      name="category"
                      value={editTemplate?.category || ""}
                      placeholder="Category"
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    />
                    <div class="grid gap-3 sm:grid-cols-3">
                      <input
                        name="duration"
                        value={editTemplate?.duration || ""}
                        placeholder="Duration"
                        class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                      />
                      <input
                        name="version"
                        value={editTemplate?.version || ""}
                        placeholder="Version"
                        class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                      />
                      <select
                        name="status"
                        class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                      >
                        {templateStatuses.map((status) => (
                          <option key={status} value={status} selected={editTemplate?.status === status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      name="audience"
                      value={editTemplate?.audience || ""}
                      placeholder="Audience"
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    />
                    <textarea
                      name="summary"
                      rows={3}
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    >
                      {editTemplate?.summary || ""}
                    </textarea>
                    <textarea
                      name="scriptBlocks"
                      rows={4}
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    >
                      {(editTemplate?.scriptBlocks || [])
                        .map((block: { title: string; copy: string }) => `${block.title}: ${block.copy}`)
                        .join("\n")}
                    </textarea>
                    <textarea
                      name="checkpoints"
                      rows={4}
                      class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                    >
                      {(editTemplate?.checkpoints || []).join("\n")}
                    </textarea>
                    <div class="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        class="rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                      >
                        {templateAdminAction.isRunning ? "Saving..." : "Update template"}
                      </button>
                      {editTemplate && (
                        <Link
                          href={`/templates/${editTemplate.slug}`}
                          class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white"
                        >
                          Open detail
                        </Link>
                      )}
                    </div>
                  </div>
                </Form>
              </div>
            </details>
          </div>
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel eyebrow="Queue" title="Recent admin requests">
            <div class="space-y-3">
              {queue.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  class="grid grid-cols-[1fr_auto] gap-4 rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4"
                >
                  <div>
                    <div class="text-sm font-black text-white">{item.title}</div>
                    <p class="mt-1 text-sm leading-6 text-white/62">{item.note}</p>
                  </div>
                  <LegalchainPill
                    label={item.priority}
                    tone={item.priority === "High" ? "danger" : item.priority === "Medium" ? "warning" : "light"}
                  />
                </div>
              ))}
            </div>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Release path" title="Workspace sequence">
            <div class="space-y-3 text-sm text-white/70">
              <div class="rounded-[20px] bg-white/[0.05] px-4 py-4">
                1. {draft ? `Draft ready: ${draft.title} can move into preview and mint.` : "Create or upload a fresh evidence draft in the record route."}
              </div>
              <div class="rounded-[20px] bg-white/[0.05] px-4 py-4">
                2. {collection ? `Base collection live: ${shortenAddress(collection.address)}.` : "The first mint will deploy the user's Base collection automatically."}
              </div>
              <div class="rounded-[20px] bg-white/[0.05] px-4 py-4">
                3. {pendingPayments > 0 ? `${pendingPayments} payment item(s) still need treasury attention.` : "Treasury queue is clear for this workspace."}
              </div>
            </div>
          </LegalchainPanel>
        </div>
      </div>

      <LegalchainPanel
        eyebrow="Library overview"
        title="Template register"
        description="Compact table for the operator who needs the full catalog at a glance."
      >
        <LegalchainTable
          columns={["Template", "Category", "Status", "Version", "Usage"]}
          rows={templateRows.map((template: LegalchainTemplateRecord) => [
            template.title,
            template.category,
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
            template.uses,
          ])}
        />
      </LegalchainPanel>
    </LegalchainPageShell>
  );
});
