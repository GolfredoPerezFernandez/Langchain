import { component$, useStyles$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { historyRecords, homeStats, paymentRecords, reviewChecklist, templateLibrary } from "~/lib/legalchain/mock";
import {
  LegalchainActionCard,
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainTable,
  LegalchainValueList,
} from "./ui";

export const LegalchainHome = component$(() => {
  useStyles$(`
    .record-orb {
      position: relative;
      overflow: hidden;
    }
    .record-orb::before {
      content: "";
      position: absolute;
      inset: 14px;
      border-radius: 999px;
      border: 1px dashed rgba(255,255,255,0.18);
    }
  `);

  return (
    <section class="space-y-8">
      <div class="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div class="space-y-6">
          <LegalchainPill label="Trusted video evidence workspace" />
          <div>
            <h1 class="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Record, review and preserve legal testimony from one workspace.
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
              Legalchain in Qwik keeps the original product rhythm: direct access to record, a strong purple identity,
              visible treasury status and routes that feel built for operators instead of demos.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <Link
              href="/auth?mode=login"
              class="rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.24em] text-[#7e0f84] shadow-[0_24px_48px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5"
            >
              Open workspace
            </Link>
            <Link
              href="/record"
              class="rounded-full border border-white/16 bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white"
            >
              Start recording
            </Link>
            <Link
              href="/templates"
              class="rounded-full border border-white/16 bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white"
            >
              Explore templates
            </Link>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Operator first", text: "Home points directly into the post-login workspace instead of a dead auth step." },
              { title: "Visible audit", text: "History, NFT profile and treasury stay present in the same story." },
              { title: "Ready for functions", text: "UI now reserves the structure needed for server actions later." },
            ].map((item) => (
              <article
                key={item.title}
                class="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_60px_rgba(10,4,22,0.3)]"
              >
                <h2 class="text-base font-black text-white">{item.title}</h2>
                <p class="mt-2 text-sm leading-6 text-white/66">{item.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div class="rounded-[36px] border border-white/10 bg-[#14071d]/78 p-6 shadow-[0_34px_100px_rgba(9,3,20,0.55)] backdrop-blur-xl sm:p-8">
          <div class="record-orb mx-auto grid h-[320px] w-[320px] place-items-center rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] ring-1 ring-white/12 shadow-[0_35px_90px_rgba(0,0,0,0.35)]">
            <div class="grid h-44 w-44 place-items-center rounded-full bg-[#7e0f84] shadow-[0_28px_80px_rgba(126,15,132,0.45)]">
              <div class="grid h-28 w-28 place-items-center rounded-full bg-white text-4xl text-[#7e0f84] shadow-[0_20px_50px_rgba(255,255,255,0.28)]">
                Play
              </div>
            </div>
          </div>
          <div class="mt-8 text-center">
            <div class="text-[12px] uppercase tracking-[0.34em] text-white/45">Core action</div>
            <h2 class="mt-3 text-3xl font-black text-white">Record a video</h2>
            <p class="mt-3 text-sm leading-7 text-white/65">
              The home screen still points to the same outcome as the original app: start a capture fast, then move
              into preview, history and proof.
            </p>
            <div class="mt-6 grid gap-3 text-left sm:grid-cols-2">
              <div class="rounded-[22px] bg-white/[0.06] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-white/40">Selected template</div>
                <div class="mt-2 text-base font-black text-white">Proof of Record</div>
              </div>
              <div class="rounded-[22px] bg-white/[0.06] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-white/40">Current mode</div>
                <div class="mt-2 text-base font-black text-white">Private capture</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LegalchainStatGrid items={homeStats} />

      <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <LegalchainPanel
          eyebrow="Template library"
          title="Featured workflows"
          description="The original Legalchain product revolved around a handful of repeatable flows. Those flows now drive the Qwik landing page too."
        >
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templateLibrary.slice(0, 3).map((template) => (
              <LegalchainActionCard
                key={template.slug}
                title={template.title}
                text={template.summary}
                href={`/templates/${template.slug}`}
                meta={`${template.category} / ${template.duration}`}
              />
            ))}
          </div>
        </LegalchainPanel>

        <LegalchainPanel eyebrow="Chain of custody" title="What the UI already makes visible">
          <LegalchainChecklist items={reviewChecklist} />
        </LegalchainPanel>
      </div>

      <div class="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <LegalchainPanel eyebrow="Recent records" title="Latest evidence items">
          <div class="space-y-4">
            {historyRecords.slice(0, 3).map((record) => (
              <Link
                key={record.hash}
                href={`/profile-nft/${record.hash}`}
                class="block rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08]"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">{record.hash}</div>
                    <h3 class="mt-2 text-lg font-black text-white">{record.title}</h3>
                  </div>
                  <LegalchainPill label={record.status} tone={record.status === "Published" ? "success" : "warning"} />
                </div>
                <p class="mt-3 text-sm leading-7 text-white/62">
                  {record.templateTitle} / {record.duration} / {record.updated}
                </p>
              </Link>
            ))}
          </div>
        </LegalchainPanel>

        <LegalchainPanel eyebrow="Treasury and review" title="Home overview">
          <div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div class="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
              <div class="text-[11px] uppercase tracking-[0.24em] text-white/40">Current workspace balance</div>
              <div class="mt-3 text-4xl font-black tracking-tight text-white">900 LC</div>
              <p class="mt-3 text-sm leading-7 text-white/62">
                Enough for regular recording, preview and audit cycles before new token purchase.
              </p>
              <div class="mt-5">
                <LegalchainValueList
                  items={[
                    { label: "Primary network", value: "Base" },
                    { label: "Last checkout", value: "Mar 20, 2026" },
                    { label: "Next route", value: "Buy token", tone: "light" },
                  ]}
                />
              </div>
            </div>
            <LegalchainTable
              columns={["Reference", "Flow", "Status", "Amount"]}
              rows={paymentRecords.map((payment) => [
                payment.reference,
                payment.flow,
                {
                  label: payment.status,
                  tone:
                    payment.status === "Approved"
                      ? "success"
                      : payment.status === "Review"
                        ? "warning"
                        : "danger",
                },
                payment.amount,
              ])}
            />
          </div>
        </LegalchainPanel>
      </div>
    </section>
  );
});
