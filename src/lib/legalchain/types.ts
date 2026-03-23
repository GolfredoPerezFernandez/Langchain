export type LegalchainUserRole = "guest" | "user" | "admin";

export interface LegalchainRouteMap {
  publicRoutes: string[];
  privateRoutes: string[];
}

export interface LegalchainFeatureArea {
  id: string;
  title: string;
  source: string[];
  target: string[];
  status: "pending" | "in-progress" | "planned";
  notes: string;
}

export interface LegalchainMigrationSummary {
  sourceFrontend: string[];
  sourceBackend: string[];
  targetStack: string[];
  routeMap: LegalchainRouteMap;
  featureAreas: LegalchainFeatureArea[];
}

export const legalchainMigrationSummary: LegalchainMigrationSummary = {
  sourceFrontend: [
    "React 18",
    "Vite",
    "Material UI",
    "Zustand",
    "Formik",
    "React Router",
    "Moralis browser SDK",
  ],
  sourceBackend: [
    "Express",
    "Parse Server",
    "Parse Dashboard",
    "Moralis auth",
    "Moralis API proxy",
    "Parse Cloud Functions",
  ],
  targetStack: [
    "Qwik",
    "Qwik City",
    "routeLoader$",
    "server$",
    "src/routes/api",
    "src/lib domain services",
  ],
  routeMap: {
    publicRoutes: ["/", "/signIn", "/signUp"],
    privateRoutes: [
      "/controlPanel",
      "/payments",
      "/ProcessStripe",
      "/templates",
      "/templates/:name",
      "/buy-token",
      "/record",
      "/preview",
      "/history",
      "/profile-nft/:hash/",
    ],
  },
  featureAreas: [
    {
      id: "auth",
      title: "Authentication and session",
      source: ["front/src/context/User/UserContext.tsx", "back/src/auth/*"],
      target: ["src/routes/legalchain/auth/*", "src/routes/api/legalchain/auth/*"],
      status: "planned",
      notes: "Move login, register, and PIN verification behind Qwik server boundaries.",
    },
    {
      id: "templates",
      title: "Template management",
      source: ["front/src/context/RenderTemplate/RenderTemplate.tsx", "back/cloud/legalChain/modules/template/*"],
      target: ["src/routes/legalchain/templates/*", "src/lib/legalchain/server.ts"],
      status: "planned",
      notes: "Replace Parse Cloud template CRUD with Qwik server services.",
    },
    {
      id: "recording",
      title: "Record, preview, and history",
      source: ["front/src/screens/record.jsx", "front/src/screens/preview.jsx", "front/src/screens/history.jsx"],
      target: ["src/routes/legalchain/record/*", "src/routes/legalchain/history/*"],
      status: "planned",
      notes: "Requires a clean browser-only recording island plus server-side persistence.",
    },
    {
      id: "payments",
      title: "Payments and Stripe",
      source: ["front/src/screens/payments.jsx", "front/src/screens/processStripe.jsx", "back/cloud/legalChain/modules/stripe/*"],
      target: ["src/routes/legalchain/payments/*", "src/routes/api/legalchain/payments/*"],
      status: "planned",
      notes: "Keep payment secrets server-side only.",
    },
    {
      id: "web3",
      title: "Wallet and token flows",
      source: ["front/src/context/Mint/MintContext.tsx", "front/src/components/form/buyToken.jsx"],
      target: ["src/routes/legalchain/wallet/*", "src/lib/legalchain/server.ts"],
      status: "pending",
      notes: "Do not port browser-side privileged Web3 logic without redesign.",
    },
  ],
};
