import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { LegalchainHome } from "~/components/legalchain/home";

export const head: DocumentHead = {
  title: "Legalchain",
  meta: [
    {
      name: "description",
      content: "Frontend Legalchain ported into the Legalchain Qwik City stack.",
    },
  ],
};

export default component$(() => <LegalchainHome />);
