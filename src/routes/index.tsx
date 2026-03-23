import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { LegalchainHome } from "~/components/legalchain/home";

export const head: DocumentHead = {
  title: "Legalchain",
  meta: [
    {
      name: "description",
      content: "Legalchain on Qwik City with the migrated frontend as the default app experience.",
    },
  ],
};

export default component$(() => <LegalchainHome />);
