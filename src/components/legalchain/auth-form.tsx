import { $, component$, useSignal } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import { LegalchainLogo } from "./logo";
import { LegalchainChecklist, LegalchainPanel, LegalchainPill } from "./ui";

interface LegalchainField {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "tel";
  placeholder: string;
}

export const LegalchainAuthForm = component$<{
  title: string;
  subtitle: string;
  submitLabel: string;
  submitHref?: string;
  submitEndpoint?: string;
  fields: LegalchainField[];
  altQuestion: string;
  altLabel: string;
  altHref: string;
  workspaceLinks?: { label: string; href: string; note: string }[];
  enablePinStep?: boolean;
}>(({
  title,
  subtitle,
  submitLabel,
  submitHref,
  submitEndpoint,
  fields,
  altQuestion,
  altLabel,
  altHref,
  workspaceLinks,
  enablePinStep,
}) => {
  const nav = useNavigate();
  const visible = useSignal<Record<string, boolean>>({});
  const submitting = useSignal(false);
  const errorMessage = useSignal("");
  const pinStep = useSignal(false);
  const stagedPayload = useSignal<Record<string, string>>({});
  const activeFields = pinStep.value && enablePinStep
    ? [
        {
          label: "PIN",
          name: "pin",
          type: "password" as const,
          placeholder: "Enter your operator PIN",
        },
      ]
    : fields;
  const isLargeForm = activeFields.length > 4;

  const toggle = $((name: string) => {
    visible.value = {
      ...visible.value,
      [name]: !visible.value[name],
    };
  });

  const submit = $(async (event: SubmitEvent) => {
    const form = event.target as HTMLFormElement | null;
    if (!form) {
      return;
    }

    errorMessage.value = "";
    const formPayload = Object.fromEntries(
      Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value)]),
    ) as Record<string, string>;
    const payload = pinStep.value && enablePinStep
      ? {
          ...stagedPayload.value,
          ...formPayload,
        }
      : formPayload;

    if (!submitEndpoint && !submitHref) {
      return;
    }

    submitting.value = true;

    try {
      if (submitEndpoint) {
        const response = await fetch(submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (enablePinStep && result.pinRequired) {
          stagedPayload.value = payload;
          pinStep.value = true;
          errorMessage.value = result.error || "PIN is required to complete sign in.";
          submitting.value = false;
          return;
        }

        if (!response.ok || result.ok === false) {
          throw new Error(result.error || "Authentication failed.");
        }
      }

      if (submitHref) {
        pinStep.value = false;
        stagedPayload.value = {};
        await nav(submitHref);
        return;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Authentication failed.";
      submitting.value = false;
    }
  });

  return (
    <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <div class="space-y-6">
        <LegalchainPanel
          eyebrow="Secure access"
          title="Legalchain operator access"
          description="The original frontend kept auth minimal. This Qwik version keeps the same direct flow and gives the user more context before entering the workspace."
        >
          <div class="flex items-center justify-between gap-4">
            <LegalchainLogo />
            <LegalchainPill label="Identity flow" />
          </div>
          <div class="mt-6">
            <LegalchainChecklist
              items={[
                {
                  title: "Fast sign in",
                  text: "Operators should reach templates, record and history in a single jump.",
                },
                {
                  title: "PIN and proof ready",
                  text: enablePinStep
                    ? "Sign in now validates credentials first and asks for the operator PIN before the private workspace opens."
                    : "Registration still provisions the wallet, PIN and session before protected viem actions are enabled.",
                },
                {
                  title: "Compact on mobile",
                  text: "The form stays narrow and readable, closer to the original Legalchain behavior.",
                },
              ]}
            />
          </div>
        </LegalchainPanel>

        {workspaceLinks && workspaceLinks.length > 0 && (
          <LegalchainPanel eyebrow="Inside the workspace" title="Private routes after access" dense>
            <div class="grid gap-3 sm:grid-cols-2">
              {workspaceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4 transition hover:bg-white/[0.08]"
                >
                  <div class="text-sm font-black text-white">{item.label}</div>
                  <p class="mt-2 text-sm leading-6 text-white/62">{item.note}</p>
                </Link>
              ))}
            </div>
          </LegalchainPanel>
        )}
      </div>

      <div class="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(25,10,36,0.96),rgba(18,9,26,0.92))] p-6 shadow-[0_30px_90px_rgba(10,4,22,0.6)] backdrop-blur-xl sm:p-8">
        <div class="flex items-center justify-between gap-4">
          <Link href="/" class="text-[11px] font-black uppercase tracking-[0.28em] text-white/55">
            Back home
          </Link>
          <LegalchainPill label={isLargeForm ? "Onboarding" : "Workspace login"} tone="light" />
        </div>
        <div class="mt-6 text-[11px] uppercase tracking-[0.34em] text-white/45">{subtitle}</div>
        <h1 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>

        {pinStep.value && enablePinStep && (
          <div class="mt-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
            Credentials verified. Enter the operator PIN to unlock the Legalchain workspace.
          </div>
        )}

        <form
          preventdefault:submit
          onSubmit$={submit}
          class={["mt-8 gap-5", isLargeForm ? "grid sm:grid-cols-2" : "space-y-5"]}
        >
          {activeFields.map((field) => {
            const isPassword = field.type === "password";
            const show = visible.value[field.name];

            return (
              <label key={field.name} class="block">
                <span class="mb-2 block text-sm font-semibold text-white/78">{field.label}</span>
                <div class="relative">
                  <input
                    name={field.name}
                    type={isPassword && show ? "text" : field.type ?? "text"}
                    placeholder={field.placeholder}
                    class="w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d672e7] focus:ring-4 focus:ring-[#d672e7]/15"
                  />
                  {isPassword && (
                    <button
                      type="button"
                      onClick$={() => toggle(field.name)}
                      class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-600"
                    >
                      {show ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
              </label>
            );
          })}

          <div class={isLargeForm ? "sm:col-span-2" : ""}>
            <button
              type="submit"
              disabled={submitting.value}
              class="w-full rounded-2xl bg-[#7e0f84] px-4 py-3 text-sm font-black uppercase tracking-[0.28em] text-white shadow-[0_18px_40px_rgba(126,15,132,0.35)] transition hover:-translate-y-0.5 hover:bg-[#93189b]"
            >
              {submitting.value ? "Entering workspace" : submitLabel}
            </button>
          </div>
        </form>

        {errorMessage.value && (
          <div class="mt-6 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
            {errorMessage.value}
          </div>
        )}

        <div class="mt-6 rounded-2xl border border-[#f7baf7]/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/65">
          Registration creates the Legalchain user, stores a custodial wallet in Turso and keeps the operator PIN available for protected sign-in, mint and treasury actions.
        </div>

        <div class="mt-6 flex items-center justify-center gap-2 text-sm text-white/70">
          <span>{altQuestion}</span>
          <Link href={altHref} class="font-bold text-white">
            {altLabel}
          </Link>
        </div>
      </div>
    </div>
  );
});
