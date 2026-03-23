import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { LegalchainAuthForm } from "~/components/legalchain/auth-form";
import { legalchainWorkspaceLinks } from "~/lib/legalchain/nav";

export const head: DocumentHead = {
  title: "Legalchain | Sign up",
};

export default component$(() => {
  return (
    <LegalchainAuthForm
      title="Sign up"
      subtitle="Create your profile"
      submitLabel="Confirm"
      submitHref="/controlPanel"
      submitEndpoint="/api/legalchain/auth/register"
      altQuestion="You have account?"
      altLabel="Sign in"
      altHref="/auth?mode=login"
      workspaceLinks={legalchainWorkspaceLinks}
      fields={[
        { label: "Full name", name: "fullname", placeholder: "Full name" },
        { label: "Email", name: "email", type: "email", placeholder: "Example@gmail.com" },
        { label: "Password", name: "password", type: "password", placeholder: "Password" },
        { label: "Repeat password", name: "repeatPassword", type: "password", placeholder: "Repeat password" },
        { label: "Pin", name: "pin", type: "password", placeholder: "Pin" },
        { label: "Phone", name: "phone", type: "tel", placeholder: "Phone" },
        { label: "Username", name: "username", placeholder: "example:SatoshiNakamoto" },
      ]}
    />
  );
});
