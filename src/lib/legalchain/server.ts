import { legalchainMigrationSummary } from "./types";

export const getLegalchainMigrationSummary = async () => {
  return legalchainMigrationSummary;
};

export const getLegalchainMigrationPhases = async () => {
  return [
    {
      phase: 1,
      title: "Application shell",
      tasks: [
        "Create Qwik route map for Legalchain",
        "Define auth/session boundaries",
        "Create domain service layer",
      ],
    },
    {
      phase: 2,
      title: "Core business flows",
      tasks: [
        "Port sign-in and sign-up",
        "Port templates CRUD",
        "Port private dashboard shell",
      ],
    },
    {
      phase: 3,
      title: "Advanced flows",
      tasks: [
        "Port recording and preview",
        "Port history",
        "Port payments and Stripe callbacks",
      ],
    },
    {
      phase: 4,
      title: "High-risk integrations",
      tasks: [
        "Port wallet and token flows",
        "Reduce Parse/Moralis frontend coupling",
        "Finalize backend persistence strategy",
      ],
    },
  ];
};
