export interface LegalchainNavItem {
  label: string;
  href: string;
  badge?: string;
}

export interface LegalchainWorkspaceLink {
  label: string;
  href: string;
  note: string;
}

export const legalchainPrivateNav: LegalchainNavItem[] = [
  { label: "Overview", href: "/controlPanel" },
  { label: "Templates", href: "/templates" },
  { label: "Record", href: "/record" },
  { label: "Preview", href: "/preview" },
  { label: "History", href: "/history" },
  { label: "Payments", href: "/payments" },
  { label: "Buy token", href: "/buy-token", badge: "Web3" },
];

export const legalchainPublicNav: LegalchainNavItem[] = [
  { label: "Home", href: "/" },
  { label: "Sign in", href: "/auth?mode=login" },
  { label: "Templates", href: "/templates" },
];

export const legalchainWorkspaceLinks: LegalchainWorkspaceLink[] = [
  {
    label: "Overview",
    href: "/controlPanel",
    note: "Private landing page with queue, template admin and workspace status.",
  },
  {
    label: "Templates",
    href: "/templates",
    note: "Browse the legal recording flows and open each template detail.",
  },
  {
    label: "Record",
    href: "/record",
    note: "Start the capture flow and choose the active script before preview.",
  },
  {
    label: "Preview",
    href: "/preview",
    note: "Review the current take, export metadata and jump into the profile record.",
  },
  {
    label: "History",
    href: "/history",
    note: "Open the evidence archive and move into each NFT profile screen.",
  },
  {
    label: "Payments",
    href: "/payments",
    note: "See pending treasury actions, approved payments and token checkout.",
  },
];
