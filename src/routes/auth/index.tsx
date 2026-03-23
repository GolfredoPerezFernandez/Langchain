import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useLocation } from "@builder.io/qwik-city";
import { LegalchainAuthForm } from "~/components/legalchain/auth-form";
import { legalchainWorkspaceLinks } from "~/lib/legalchain/nav";

export const head: DocumentHead = {
  title: "Legalchain Auth",
  meta: [
    {
      name: "description",
      content: "Legalchain authentication entry migrated to Qwik.",
    },
  ],
};

export default component$(() => {
  const location = useLocation();
  const mode = location.url.searchParams.get("mode");
  const isLogin = mode === "login";

  return (
    <LegalchainAuthForm
      title={isLogin ? "Sign in" : "Create your Legalchain account"}
      subtitle={isLogin ? "Access your workspace" : "Operator onboarding"}
      submitLabel={isLogin ? "Confirm" : "Create account"}
      submitHref="/controlPanel"
      submitEndpoint={isLogin ? "/api/legalchain/auth/login" : "/api/legalchain/auth/register"}
      fields={
        isLogin
          ? [
              {
                label: "Email",
                name: "email",
                type: "email",
                placeholder: "name@company.com",
              },
              {
                label: "Password",
                name: "password",
                type: "password",
                placeholder: "Enter your password",
              },
            ]
          : [
              {
                label: "Full name",
                name: "fullName",
                placeholder: "Jane Smith",
              },
              {
                label: "Work email",
                name: "email",
                type: "email",
                placeholder: "legal@company.com",
              },
              {
                label: "Phone",
                name: "phone",
                type: "tel",
                placeholder: "+1 555 555 5555",
              },
              {
                label: "Password",
                name: "password",
                type: "password",
                placeholder: "Create a secure password",
              },
              {
                label: "Repeat password",
                name: "repeatPassword",
                type: "password",
                placeholder: "Repeat your password",
              },
              {
                label: "PIN",
                name: "pin",
                type: "password",
                placeholder: "4-6 digit operator PIN",
              },
              {
                label: "Username",
                name: "username",
                placeholder: "operator.handle",
              },
            ]
      }
      altQuestion={isLogin ? "Need an account?" : "Already have an account?"}
      altLabel={isLogin ? "Sign up" : "Sign in"}
      altHref={isLogin ? "/auth?mode=signup" : "/auth?mode=login"}
      workspaceLinks={legalchainWorkspaceLinks}
      enablePinStep={isLogin}
    />
  );
});
