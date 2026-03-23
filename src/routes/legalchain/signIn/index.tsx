import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { LegalchainAuthForm } from "~/components/legalchain/auth-form";
import { legalchainWorkspaceLinks } from "~/lib/legalchain/nav";

export const head: DocumentHead = {
  title: "Legalchain | Sign in",
};

export default component$(() => {
  return (
    <LegalchainAuthForm
      title="Sign in"
      subtitle="Access your account"
      submitLabel="Confirm"
      submitHref="/controlPanel"
      submitEndpoint="/api/legalchain/auth/login"
      altQuestion="You don't have account?"
      altLabel="Sign up"
      altHref="/auth?mode=signup"
      workspaceLinks={legalchainWorkspaceLinks}
      fields={[
        { label: "Email", name: "email", type: "email", placeholder: "Email" },
        { label: "Password", name: "password", type: "password", placeholder: "Password" },
      ]}
    />
  );
});
