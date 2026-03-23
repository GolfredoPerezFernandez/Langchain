import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainValueList,
} from "~/components/legalchain/ui";
import { getCurrentLegalchainUser, getLegalchainRecordByHash } from "~/lib/legalchain/store";

export const useRecordProfileLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const record = await getLegalchainRecordByHash(event.params.hash, user.id);
  if (!record) {
    throw event.redirect(302, "/history");
  }

  return { user, record };
});

export default component$(() => {
  const { record } = useRecordProfileLoader().value;
  const assetType = String(record.metadataJson.assetType ?? "");
  const mediaUrl =
    record.mediaUrl ||
    String(record.metadataJson.animation_url ?? record.metadataJson.image ?? record.metadataJson.external_url ?? "");

  const statusTone =
    record.status === "Published" ? "success" : record.status === "Review" ? "warning" : "default";

  return (
    <LegalchainPageShell
      eyebrow="Profile record"
      title={record.title}
      description="The profile route now behaves like the original Legalchain evidence screen: media first, metadata second, operator tools always visible and blockchain proof fields filled from the backend mint flow."
      actions={[
        { label: "Back to history", href: "/history" },
        { label: "Open preview", href: "/preview" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Record hash", value: record.hash, hint: "Primary identifier for the stored evidence item." },
          { label: "Token ID", value: record.tokenId, hint: "NFT reference minted and persisted for this evidence item." },
          { label: "Visibility", value: record.visibility, hint: "Current publication mode for the asset." },
          { label: "Network", value: record.network, hint: "Base chain context used for collection deploy and proof minting." },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel
          eyebrow="Media"
          title="Record preview"
          description="The Qwik profile keeps media first and now renders the stored evidence source from the minted metadata whenever it is available."
        >
          <div class="rounded-[28px] border border-white/10 bg-[#09050f] p-5">
            {assetType.startsWith("video/") && mediaUrl ? (
              <video
                class="min-h-[420px] w-full rounded-[24px] border border-white/10 object-cover"
                controls
                src={mediaUrl}
              />
            ) : assetType.startsWith("audio/") && mediaUrl ? (
              <div class="grid min-h-[420px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.24),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] px-8 text-center">
                <div class="w-full max-w-lg space-y-5">
                  <div class="text-[11px] font-black uppercase tracking-[0.28em] text-white/42">Audio evidence</div>
                  <div class="text-3xl font-black text-white">{record.templateTitle}</div>
                  <audio class="w-full" controls src={mediaUrl} />
                </div>
              </div>
            ) : assetType === "application/pdf" && mediaUrl ? (
              <div class="grid min-h-[420px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.24),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] text-center">
                <div class="max-w-md space-y-4 px-6">
                  <div class="text-[11px] font-black uppercase tracking-[0.28em] text-white/42">Document evidence</div>
                  <div class="text-3xl font-black text-white">{record.templateTitle}</div>
                  <a
                    href={mediaUrl}
                    target="_blank"
                    class="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#7e0f84]"
                    rel="noreferrer"
                  >
                    Open document
                  </a>
                </div>
              </div>
            ) : (
              <div class="grid min-h-[420px] place-items-center rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.24),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] text-center">
                <div class="max-w-md space-y-3 px-6">
                  <div class="text-[11px] font-black uppercase tracking-[0.28em] text-white/42">Evidence surface</div>
                  <div class="text-3xl font-black text-white">{record.templateTitle}</div>
                  <p class="text-sm leading-7 text-white/62">
                    {mediaUrl
                      ? "The minted asset already has a media URL tied to its metadata."
                      : "This NFT keeps the proof metadata onchain, but no direct playback URL was stored for this record."}
                  </p>
                  {mediaUrl && (
                    <a
                      href={mediaUrl}
                      target="_blank"
                      class="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#7e0f84]"
                      rel="noreferrer"
                    >
                      Open media
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
              <div class="text-[10px] uppercase tracking-[0.22em] text-white/38">Created</div>
              <div class="mt-2 text-sm font-semibold text-white">{record.createdAt}</div>
            </div>
            <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
              <div class="text-[10px] uppercase tracking-[0.22em] text-white/38">Duration</div>
              <div class="mt-2 text-sm font-semibold text-white">{record.duration}</div>
            </div>
            <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4">
              <div class="text-[10px] uppercase tracking-[0.22em] text-white/38">Status</div>
              <div class="mt-2">
                <LegalchainPill label={record.status} tone={statusTone} />
              </div>
            </div>
          </div>
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel eyebrow="Metadata" title="Evidence details">
            <LegalchainValueList
              items={[
                { label: "Owner", value: record.owner },
                { label: "Template", value: record.templateTitle },
                { label: "Collection", value: record.collectionName || "Not linked" },
                { label: "Contract", value: record.contract },
                { label: "IPFS", value: record.ipfs },
                { label: "Network", value: record.network },
                { label: "Visibility", value: record.visibility },
              ]}
            />
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Operator tools" title="Available actions">
            <div class="grid gap-3">
              <Link
                href="/preview"
                class="rounded-full bg-white px-4 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                Open preview
              </Link>
              <Link
                href="/history"
                class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Return to history
              </Link>
              <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4 text-sm leading-7 text-white/62">
                Transaction hash: {record.txHash}. Token ID, collection and IPFS are already persisted from the backend mint flow.
              </div>
            </div>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Validation" title="Before sharing">
            <LegalchainChecklist
              items={[
                {
                  title: "Confirm identity and case context",
                  text: "The opening seconds should still match the legal metadata shown on this profile.",
                },
                {
                  title: "Verify proof references",
                  text: "Token ID, contract, tx hash and IPFS should match the persisted Base mint transaction for this NFT.",
                },
                {
                  title: "Choose the next route",
                  text: "Operators can continue into preview, history or treasury without losing record context.",
                },
              ]}
            />
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});
