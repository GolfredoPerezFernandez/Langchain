export interface LegalchainStat {
  label: string;
  value: string;
  hint?: string;
}

export interface LegalchainTemplate {
  slug: string;
  title: string;
  category: string;
  duration: string;
  status: "Published" | "Draft" | "Review";
  version: string;
  uses: string;
  summary: string;
  audience: string;
  scriptBlocks: { title: string; copy: string }[];
  checkpoints: string[];
}

export interface LegalchainRecord {
  hash: string;
  title: string;
  templateSlug: string;
  templateTitle: string;
  status: "Published" | "Draft" | "Review";
  updated: string;
  duration: string;
  visibility: "Private" | "Shared";
  owner: string;
  tokenId: string;
  contract: string;
  ipfs: string;
  network: string;
  createdAt: string;
}

export interface LegalchainPayment {
  reference: string;
  flow: string;
  status: "Pending" | "Approved" | "Review";
  amount: string;
  method: string;
  requestedAt: string;
}

export interface LegalchainTokenPlan {
  id: string;
  name: string;
  amount: string;
  tokens: string;
  eth: string;
  badge: string;
  note: string;
  features: string[];
}

export const homeStats: LegalchainStat[] = [
  { label: "Templates", value: "24", hint: "Ready for record, preview and audit." },
  { label: "Records", value: "142", hint: "Active legal evidence items in the workspace." },
  { label: "Treasury", value: "$4.3k", hint: "Payments tracked across token and Stripe flows." },
  { label: "SLA", value: "48h", hint: "Current review target for published evidence." },
];

export const templateLibrary: LegalchainTemplate[] = [
  {
    slug: "proof-of-record",
    title: "Proof of Record",
    category: "Evidence",
    duration: "60-90 sec",
    status: "Published",
    version: "v2.4",
    uses: "184",
    summary: "Structured legal statement for identity, consent and delivery of audiovisual proof.",
    audience: "Operations and legal review",
    scriptBlocks: [
      {
        title: "Identity",
        copy: "State full name, role, jurisdiction and reason for the recording in one direct opening line.",
      },
      {
        title: "Consent",
        copy: "Confirm the statement is voluntary and that supporting files can be linked to the record.",
      },
      {
        title: "Evidence summary",
        copy: "Describe the event, related documents and the expected use of the final notarized output.",
      },
    ],
    checkpoints: [
      "Identity fields must be visible in the first 10 seconds.",
      "Consent language cannot be edited by operators.",
      "Summary block should map to the final PDF and NFT metadata.",
    ],
  },
  {
    slug: "legal-intro",
    title: "Legal Intro",
    category: "Onboarding",
    duration: "30-45 sec",
    status: "Published",
    version: "v1.9",
    uses: "112",
    summary: "Short opening template used to register a participant before continuing into long evidence flows.",
    audience: "Client intake",
    scriptBlocks: [
      {
        title: "Greeting",
        copy: "Introduce the participant and identify the case, dossier or internal request number.",
      },
      {
        title: "Scope",
        copy: "Clarify what this intro validates and where the extended declaration will continue.",
      },
      {
        title: "Handoff",
        copy: "Send the operator to the next template or ask for an additional supporting capture.",
      },
    ],
    checkpoints: [
      "Case ID must be present on screen.",
      "Operator can swap language and locale copy.",
      "Built for mobile-first capture with low friction.",
    ],
  },
  {
    slug: "client-summary",
    title: "Client Summary",
    category: "Case review",
    duration: "90-120 sec",
    status: "Review",
    version: "v0.8",
    uses: "37",
    summary: "Narrative format for case summaries, escalation notes and executive legal updates.",
    audience: "Partner review",
    scriptBlocks: [
      {
        title: "Context",
        copy: "Explain the matter, parties and the state of the current review in plain legal language.",
      },
      {
        title: "Decision points",
        copy: "Capture pending approvals, blockers and immediate risk signals for the receiving team.",
      },
      {
        title: "Next actions",
        copy: "List the next documents, follow-up recordings or payment events needed to close the task.",
      },
    ],
    checkpoints: [
      "Summary block should stay under two minutes.",
      "Designed for partner playback and treasury alignment.",
      "Pending legal review before broad publication.",
    ],
  },
  {
    slug: "chain-custody-check",
    title: "Chain Custody Check",
    category: "Compliance",
    duration: "45-60 sec",
    status: "Draft",
    version: "v0.6",
    uses: "18",
    summary: "Compact workflow used to verify custody transfers, timestamps and storage continuity.",
    audience: "Compliance",
    scriptBlocks: [
      {
        title: "Transfer event",
        copy: "Describe the custody movement, source owner and target owner with timestamp reference.",
      },
      {
        title: "Storage trace",
        copy: "Attach or mention storage locations, supporting upload IDs and handoff evidence.",
      },
      {
        title: "Verification",
        copy: "State whether the transfer is accepted, rejected or still awaiting secondary review.",
      },
    ],
    checkpoints: [
      "Draft state until viem proof flow replaces legacy chain checks.",
      "Best used with upload receipt and payment reference side by side.",
      "Requires admin release once functional backend arrives.",
    ],
  },
];

export const historyRecords: LegalchainRecord[] = [
  {
    hash: "hash-001",
    title: "Power of attorney review",
    templateSlug: "proof-of-record",
    templateTitle: "Proof of Record",
    status: "Published",
    updated: "2h ago",
    duration: "01:12",
    visibility: "Private",
    owner: "Ana Ribeiro",
    tokenId: "8842",
    contract: "0x93A4...52C1",
    ipfs: "ipfs://bafy...001",
    network: "Base",
    createdAt: "Mar 20, 2026 - 14:20",
  },
  {
    hash: "hash-002",
    title: "Client onboarding confirmation",
    templateSlug: "legal-intro",
    templateTitle: "Legal Intro",
    status: "Review",
    updated: "Yesterday",
    duration: "00:41",
    visibility: "Shared",
    owner: "Luis Ferrer",
    tokenId: "8819",
    contract: "0x93A4...52C1",
    ipfs: "ipfs://bafy...002",
    network: "Base",
    createdAt: "Mar 19, 2026 - 09:08",
  },
  {
    hash: "hash-003",
    title: "Quarterly partner summary",
    templateSlug: "client-summary",
    templateTitle: "Client Summary",
    status: "Draft",
    updated: "3 days ago",
    duration: "01:44",
    visibility: "Private",
    owner: "Marta Leon",
    tokenId: "8761",
    contract: "0x51E1...7F12",
    ipfs: "ipfs://bafy...003",
    network: "Base",
    createdAt: "Mar 18, 2026 - 17:42",
  },
  {
    hash: "hash-004",
    title: "Custody transfer note",
    templateSlug: "chain-custody-check",
    templateTitle: "Chain Custody Check",
    status: "Review",
    updated: "5 days ago",
    duration: "00:56",
    visibility: "Private",
    owner: "Daniel Cortez",
    tokenId: "8724",
    contract: "0x51E1...7F12",
    ipfs: "ipfs://bafy...004",
    network: "Base",
    createdAt: "Mar 16, 2026 - 11:05",
  },
];

export const paymentRecords: LegalchainPayment[] = [
  {
    reference: "442188",
    flow: "Proof of Record",
    status: "Pending",
    amount: "$150",
    method: "Bank validation",
    requestedAt: "Mar 20 - 15:20",
  },
  {
    reference: "811240",
    flow: "Legal Intro",
    status: "Approved",
    amount: "$275",
    method: "Stripe",
    requestedAt: "Mar 20 - 10:45",
  },
  {
    reference: "901133",
    flow: "Client Summary",
    status: "Approved",
    amount: "$480",
    method: "Stripe",
    requestedAt: "Mar 19 - 16:30",
  },
  {
    reference: "903021",
    flow: "Chain Custody Check",
    status: "Review",
    amount: "$220",
    method: "Manual proof",
    requestedAt: "Mar 19 - 09:12",
  },
];

export const tokenPlans: LegalchainTokenPlan[] = [
  {
    id: "starter",
    name: "Starter",
    amount: "$25",
    tokens: "250 LC",
    eth: "0.007 ETH",
    badge: "Fast start",
    note: "Best for demos, short evidence captures and intake sessions.",
    features: [
      "Ideal for legal intro and onboarding flows.",
      "Enough balance for pilot reviews and one-off previews.",
      "Quickest path into Stripe checkout.",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    amount: "$75",
    tokens: "900 LC",
    eth: "0.021 ETH",
    badge: "Most used",
    note: "Balanced package for recurring teams handling record, preview and payment approvals.",
    features: [
      "Fits weekly operations and template testing.",
      "Supports draft plus published evidence cycles.",
      "Pairs well with admin treasury review.",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    amount: "$150",
    tokens: "2.1k LC",
    eth: "0.043 ETH",
    badge: "High volume",
    note: "Recommended for firms handling heavy playback, revisions and multi-step reviews.",
    features: [
      "Built for larger review teams and repeated exports.",
      "Leaves headroom for manual chain verification and retries.",
      "Future-ready for viem based proof workflows.",
    ],
  },
];

export const controlPanelQueue = [
  { title: "Client Summary", note: "Needs legal review", priority: "High" },
  { title: "Proof of Record", note: "Waiting metadata audit", priority: "Medium" },
  { title: "Chain Custody Check", note: "Draft copy pending ops feedback", priority: "Medium" },
  { title: "Legal Intro", note: "Ready to publish", priority: "Low" },
];

export const reviewChecklist = [
  {
    title: "Identity first",
    text: "Every record should front-load participant identity, case context and operator ownership.",
  },
  {
    title: "Immutable proof later",
    text: "UI should already reserve space for contract, token ID and IPFS fields even before backend wiring.",
  },
  {
    title: "Treasury visible",
    text: "Payment state and token balance need to stay visible near record and preview routes.",
  },
];

export const getTemplateBySlug = (slug: string): LegalchainTemplate =>
  templateLibrary.find((template) => template.slug === slug) ?? templateLibrary[0];

export const getRecordByHash = (hash: string): LegalchainRecord =>
  historyRecords.find((record) => record.hash === hash) ?? {
    ...historyRecords[0],
    hash,
    title: `Record ${hash}`,
  };
