import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$, useLocation } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainPanel,
  LegalchainSearchBox,
  LegalchainStatGrid,
  LegalchainTable,
} from "~/components/legalchain/ui";
import {
  getCurrentLegalchainUser,
  listLegalchainRecords,
  type LegalchainRecordRow,
} from "~/lib/legalchain/store";

export const useHistoryLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const records = await listLegalchainRecords(user.id);
  return { user, records };
});

export default component$(() => {
  const location = useLocation();
  const data = useHistoryLoader().value;
  const search = location.url.searchParams.get("q")?.trim().toLowerCase() || "";
  const records: LegalchainRecordRow[] = search
    ? data.records.filter(
        (record: LegalchainRecordRow) =>
          record.hash.toLowerCase().includes(search) || record.title.toLowerCase().includes(search),
      )
    : data.records;
  const publishedCount = records.filter((record: LegalchainRecordRow) => record.status === "Published").length;
  const reviewCount = records.filter((record: LegalchainRecordRow) => record.status === "Review").length;

  return (
    <LegalchainPageShell
      eyebrow="Private route"
      title="History"
      description="History now looks like the real Legalchain archive: filters first, then record cards, then a ledger for operators who need the compact view."
      actions={[{ label: "Record again", href: "/record" }]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Records", value: `${records.length}`.padStart(2, "0"), hint: "Stored outputs in the current workspace." },
          {
            label: "Published",
            value: `${publishedCount}`.padStart(2, "0"),
            hint: "Live evidence items with a visible profile record.",
          },
          {
            label: "Review",
            value: `${reviewCount}`.padStart(2, "0"),
            hint: "Awaiting approval or payment matching.",
          },
          { label: "Retention", value: "90d", hint: "Current archive policy target." },
        ]}
      />

      <LegalchainPanel eyebrow="Filters" title="Search and status">
        <div class="grid gap-3 md:grid-cols-3">
          <LegalchainSearchBox placeholder="Search by hash or title" />
          <LegalchainSearchBox placeholder="Filter by date range" />
          <LegalchainSearchBox placeholder="Filter by template or state" />
        </div>
      </LegalchainPanel>

      {records.length > 0 ? (
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => (
            <Link
              key={record.hash}
              href={`/profile-nft/${record.hash}`}
              class="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,10,35,0.95),rgba(17,9,24,0.9))] p-6 shadow-[0_22px_80px_rgba(12,5,24,0.32)] transition hover:-translate-y-1"
            >
              <div class="text-[11px] uppercase tracking-[0.28em] text-white/45">{record.hash}</div>
              <div class="mt-3 text-xl font-black text-white">{record.title}</div>
              <p class="mt-3 text-sm leading-7 text-white/66">{record.templateTitle}</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/36">Status</div>
                  <div class="mt-1 text-sm text-white/80">{record.status}</div>
                </div>
                <div>
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/36">Updated</div>
                  <div class="mt-1 text-sm text-white/80">{record.updated}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <LegalchainPanel
          eyebrow="Archive"
          title="No minted records yet"
          description="A new Legalchain user starts without onchain evidence. Create a record and mint it on Base to populate this archive."
        >
          <div class="flex flex-wrap gap-3">
            <Link
              href="/record"
              class="rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
            >
              Start recording
            </Link>
            <Link
              href="/preview"
              class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white"
            >
              Open preview
            </Link>
          </div>
        </LegalchainPanel>
      )}

      <LegalchainPanel eyebrow="History ledger" title="Compact operator view">
        {records.length > 0 ? (
          <LegalchainTable
            columns={["Hash", "Template", "Status", "Updated"]}
            rows={records.map((record) => [
              record.hash,
              record.templateTitle,
              record.status,
              record.updated,
            ])}
          />
        ) : (
          <p class="text-sm leading-7 text-white/62">
            The ledger will appear here after the first successful mint.
          </p>
        )}
      </LegalchainPanel>
    </LegalchainPageShell>
  );
});
