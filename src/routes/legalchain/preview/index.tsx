import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainStatGrid,
  LegalchainValueList,
} from "~/components/legalchain/ui";
import {
  clearLegalchainDraft,
  getCurrentLegalchainUser,
  getLegalchainDraftByUserId,
  getLatestLegalchainRecordByUserId,
} from "~/lib/legalchain/store";
import { mintLegalchainNft } from "~/lib/legalchain/nft";

export const usePreviewLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const [draft, record] = await Promise.all([
    getLegalchainDraftByUserId(user.id),
    getLatestLegalchainRecordByUserId(user.id),
  ]);

  return {
    user,
    draft,
    record,
  };
});

export const usePreviewMintAction = routeAction$(async (form, event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const title = String(form.title ?? "").trim();
  if (!title) {
    return {
      ok: false,
      error: "Title is required.",
    };
  }

  const draft = await getLegalchainDraftByUserId(user.id);
  if (!draft) {
    return {
      ok: false,
      error: "Save a draft in Record before minting on Base.",
    };
  }

  const metadata = draft
    ? {
        image: draft.assetUri,
        animation_url: draft.assetUri,
        external_url: draft.assetHttpUrl,
        assetName: draft.assetName,
        assetType: draft.assetType,
        startDateRecord: draft.captureStartedAt,
        endDateRecord: draft.captureEndedAt,
      }
    : {};

  const result = await mintLegalchainNft(
    {
      userId: user.id,
      title,
      description: String(form.description ?? "").trim() || draft?.description || "",
      templateSlug: String(form.templateSlug ?? "").trim() || draft?.templateSlug || "",
      templateTitle: String(form.templateTitle ?? "").trim() || draft?.templateTitle || "",
      duration: String(form.duration ?? "").trim() || draft?.duration || "",
      visibility: String(form.visibility ?? "Private").trim() || draft?.visibility || "Private",
      pin: String(form.pin ?? "").trim(),
      metadata,
    },
    event,
  );

  if (draft) {
    await clearLegalchainDraft(user.id);
  }

  throw event.redirect(302, `/profile-nft/${result.txHash}`);
});

export default component$(() => {
  const { draft, record } = usePreviewLoader().value;
  const mintAction = usePreviewMintAction();
  const currentPreview = draft
      ? {
          hash: "draft-preview",
          title: draft.title,
          description: draft.description,
          duration: draft.duration,
        templateTitle: draft.templateTitle,
        templateSlug: draft.templateSlug,
        owner: "Pending operator",
        visibility: draft.visibility,
          status: "Draft",
          mediaUrl: draft.assetHttpUrl,
          assetType: draft.assetType,
          assetName: draft.assetName,
          captureStartedAt: draft.captureStartedAt,
          captureEndedAt: draft.captureEndedAt,
        }
      : record
      ? {
          ...record,
          captureStartedAt: record.startDateRecord,
          captureEndedAt: record.endDateRecord,
          assetType: String(record.metadataJson.assetType ?? ""),
          assetName: String(record.metadataJson.assetName ?? record.title),
        }
      : {
          hash: "draft-preview",
          title: "Proof of Record",
          description: "No draft uploaded yet.",
          duration: "00:00",
          templateTitle: "Proof of Record",
          templateSlug: "proof-of-record",
          owner: "Pending operator",
          visibility: "Private",
          status: "Draft",
          mediaUrl: "",
          assetType: "",
          assetName: "legalchain-proof",
          captureStartedAt: "",
          captureEndedAt: "",
        };
  const hasDraft = Boolean(draft);
  const hasPublishedRecord = Boolean(!draft && record);

  return (
    <LegalchainPageShell
      eyebrow="Private route"
      title="Preview"
      description="The preview route now behaves like a real review step: uploaded evidence first, metadata second, then the final mint into the user's Base collection."
      actions={[
        { label: "Back to record", href: "/record" },
        {
          label: hasPublishedRecord ? "Open profile record" : "Open history",
          href: hasPublishedRecord ? `/profile-nft/${currentPreview.hash}` : "/history",
        },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Source", value: hasDraft ? "Draft asset" : "Published record", hint: "Preview prefers the current draft over the archive." },
          { label: "Duration", value: currentPreview.duration, hint: "Captured from the current take." },
          { label: "Template", value: currentPreview.templateTitle, hint: "Active script used in the session." },
          { label: "Next", value: hasDraft ? "Mint" : "Review", hint: "A saved draft can be minted immediately on Base." },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel eyebrow="Player" title="Evidence review">
          <div class="rounded-[28px] border border-white/10 bg-[#09050e] p-5">
            {currentPreview.assetType.startsWith("video/") ? (
              <video
                class="min-h-[380px] w-full rounded-[24px] border border-white/10 object-cover"
                controls
                src={currentPreview.mediaUrl}
              />
            ) : currentPreview.assetType.startsWith("audio/") ? (
              <div class="grid min-h-[380px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8">
                <div class="w-full max-w-lg space-y-5 text-center">
                  <div class="text-3xl font-black text-white">{currentPreview.templateTitle}</div>
                  <audio class="w-full" controls src={currentPreview.mediaUrl} />
                </div>
              </div>
            ) : currentPreview.assetType === "application/pdf" && currentPreview.mediaUrl ? (
              <div class="grid min-h-[380px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 text-center">
                <div class="space-y-4">
                  <div class="text-3xl font-black text-white">{currentPreview.templateTitle}</div>
                  <a
                    href={currentPreview.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                  >
                    Open document preview
                  </a>
                </div>
              </div>
            ) : (
              <div class="grid min-h-[380px] place-items-center rounded-[24px] border border-dashed border-white/15 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] text-white/58">
                Preview surface for the current recording
              </div>
            )}
          </div>
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel eyebrow="Export summary" title="Current output">
            <LegalchainValueList
              items={[
                { label: "Record hash", value: currentPreview.hash },
                { label: "Owner", value: currentPreview.owner },
                { label: "Visibility", value: currentPreview.visibility },
                {
                  label: "Status",
                  value: currentPreview.status,
                  tone: currentPreview.status === "Published" ? "success" : "warning",
                },
                {
                  label: "Asset",
                  value: currentPreview.mediaUrl ? "Storacha uploaded" : "Pending upload",
                  tone: currentPreview.mediaUrl ? "success" : "warning",
                },
                {
                  label: "Capture started",
                  value: currentPreview.captureStartedAt || "Not set",
                },
                {
                  label: "Capture ended",
                  value: currentPreview.captureEndedAt || "Not set",
                },
              ]}
            />
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              {hasPublishedRecord ? (
                <a
                  href={`/profile-nft/${currentPreview.hash}`}
                  class="rounded-full bg-white px-4 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                >
                  Open profile
                </a>
              ) : (
                <Link
                  href="/record"
                  class="rounded-full bg-white px-4 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                >
                  Edit draft
                </Link>
              )}
              {currentPreview.mediaUrl ? (
                <a
                  href={currentPreview.mediaUrl}
                  download={currentPreview.assetName || currentPreview.title}
                  target="_blank"
                  rel="noreferrer"
                  class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Download asset
                </a>
              ) : (
                <a
                  href="/history"
                  class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Open history
                </a>
              )}
            </div>
          </LegalchainPanel>

          <LegalchainPanel
            eyebrow="Blockchain"
            title="Mint proof NFT"
            description="This action uses the user's custodial wallet on Base. If the user has no collection yet, the backend deploys it first and then mints into it."
          >
            {hasDraft ? (
              <Form action={mintAction} class="space-y-4">
                <input type="hidden" name="templateSlug" value={currentPreview.templateSlug} />
                <input type="hidden" name="templateTitle" value={currentPreview.templateTitle} />
                <input type="hidden" name="duration" value={currentPreview.duration} />
                <input type="hidden" name="visibility" value={currentPreview.visibility} />

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">NFT title</div>
                  <input
                    name="title"
                    value={currentPreview.title}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Description</div>
                  <textarea
                    name="description"
                    rows={4}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  >
                    {currentPreview.description || `Preview export for ${currentPreview.templateTitle}.`}
                  </textarea>
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Operator PIN</div>
                  <input
                    name="pin"
                    type="password"
                    placeholder="PIN used for protected actions"
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                {mintAction.value && !mintAction.value.ok && (
                  <div class="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {mintAction.value.error}
                  </div>
                )}

                <button
                  type="submit"
                  class="w-full rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                >
                  {mintAction.isRunning ? "Minting..." : "Mint on Base"}
                </button>
              </Form>
            ) : (
              <div class="space-y-4">
                <div class="rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Save a fresh draft in Record before minting. Preview can still show the last published asset, but mint now requires a current draft.
                </div>
                {mintAction.value && !mintAction.value.ok && (
                  <div class="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {mintAction.value.error}
                  </div>
                )}
                <Link
                  href="/record"
                  class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                >
                  Go to record
                </Link>
              </div>
            )}
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Review checklist" title="Before publishing">
            <LegalchainChecklist
              items={[
                { title: "Watch the opening seconds", text: "Identity, consent and case references should read clearly on the first pass." },
                { title: "Confirm metadata", text: "Duration, owner and proof fields need to match the intended final record." },
                { title: "Choose the next route", text: "Operators should continue either to history, payments or the NFT profile." },
              ]}
            />
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});
