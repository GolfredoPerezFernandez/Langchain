import {
  $,
  component$,
  noSerialize,
  useSignal,
  useStore,
  useVisibleTask$,
  type NoSerialize,
} from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
} from "~/components/legalchain/ui";
import {
  getCurrentLegalchainUser,
  getLegalchainDraftByUserId,
  getLegalchainTemplateBySlug,
  listLegalchainTemplates,
  upsertLegalchainDraft,
  type LegalchainDraftRecord,
  type LegalchainTemplateRecord,
} from "~/lib/legalchain/store";
import { uploadAssetToStoracha } from "~/lib/legalchain/storacha";

const isUploadFile = (value: unknown): value is File =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as File).arrayBuffer === "function" &&
  typeof (value as File).size === "number";

const toIsoOrFallback = (value: string, fallback: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const fallbackTemplate: LegalchainTemplateRecord = {
  slug: "proof-of-record",
  title: "Proof of Record",
  category: "Evidence",
  duration: "00:45",
  status: "Draft",
  version: "v1.0",
  uses: "0",
  summary: "No template available yet.",
  audience: "Legal Ops",
  scriptBlocks: [],
  checkpoints: [],
};

const getTemplateBySlug = (templates: LegalchainTemplateRecord[], slug: string) =>
  templates.find((template) => template.slug === slug) ?? null;

const buildTeleprompterText = (template: LegalchainTemplateRecord | null) => {
  if (!template) {
    return "Select a template to load the record script.";
  }

  const blocks = template.scriptBlocks
    .map((block) => `${block.title ? `${block.title}\n` : ""}${block.copy}`.trim())
    .filter(Boolean);

  if (blocks.length > 0) {
    return blocks.join("\n\n");
  }

  return template.summary.trim() || "This template has no script blocks yet.";
};

const buildChecklistItems = (template: LegalchainTemplateRecord | null) => {
  if (!template) {
    return [
      {
        title: "Choose a template",
        text: "The checklist will populate from the live Turso template once one is selected.",
      },
    ];
  }

  if (template.checkpoints.length > 0) {
    return template.checkpoints.map((checkpoint, index) => ({
      title: template.scriptBlocks[index]?.title || `Checkpoint ${String(index + 1).padStart(2, "0")}`,
      text: checkpoint,
    }));
  }

  if (template.scriptBlocks.length > 0) {
    return template.scriptBlocks.slice(0, 3).map((block, index) => ({
      title: block.title || `Block ${String(index + 1).padStart(2, "0")}`,
      text: block.copy,
    }));
  }

  return [
    {
      title: "Template summary",
      text: template.summary || "Add checkpoints to this template from the control panel.",
    },
  ];
};

const buildFlowItems = (template: LegalchainTemplateRecord | null) => {
  if (!template) {
    return [
      {
        title: "Template not loaded",
        text: "Choose a template to see the recommended block order for this capture.",
      },
    ];
  }

  if (template.scriptBlocks.length > 0) {
    return template.scriptBlocks.slice(0, 3).map((block, index) => ({
      title: block.title || `Block ${String(index + 1).padStart(2, "0")}`,
      text: block.copy,
    }));
  }

  return [
    {
      title: "Summary",
      text: template.summary || "No block guidance is configured yet for this template.",
    },
  ];
};

const formatClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

const normalizeDurationLabel = (seconds: number) => formatClock(seconds);

const resolveRecorderMimeType = () => {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
};

const revokeLocalUrl = (value: string) => {
  if (value && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
};

type RecorderStatus = "idle" | "countdown" | "recording" | "paused" | "ready" | "submitting";

interface RecorderControls {
  ensureStream: () => Promise<void>;
  syncSelectedFile: (file?: File | null, sourceLabel?: string) => void;
  startCapture: () => Promise<void>;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => void;
  saveCaptureToForm: () => void;
}

export const useRecordLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const templates = await listLegalchainTemplates();
  const draft = await getLegalchainDraftByUserId(user.id);
  return {
    user,
    draft,
    templates,
    selectedTemplate: draft
      ? templates.find((template: LegalchainTemplateRecord) => template.slug === draft.templateSlug) ?? templates[0] ?? null
      : templates[0] ?? null,
  };
});

export const useRecordDraftAction = routeAction$(async (form, event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const templateSlug = String(form.templateSlug ?? "").trim();
  const template = templateSlug ? await getLegalchainTemplateBySlug(templateSlug) : null;
  if (!template) {
    return {
      ok: false,
      error: "Select a valid template before continuing.",
    };
  }

  const existingDraft = await getLegalchainDraftByUserId(user.id);
  const media = form.media;
  let assetUri = existingDraft?.assetUri ?? "";
  let assetHttpUrl = existingDraft?.assetHttpUrl ?? "";
  let assetName = existingDraft?.assetName ?? "";
  let assetType = existingDraft?.assetType ?? "application/octet-stream";

  try {
    if (isUploadFile(media) && media.size > 0) {
      const uploadedAsset = await uploadAssetToStoracha(
        {
          bytes: new Uint8Array(await media.arrayBuffer()),
          name: media.name,
          type: media.type,
        },
        event,
      );

      assetUri = uploadedAsset.assetURI;
      assetHttpUrl = uploadedAsset.httpUrl;
      assetName = media.name;
      assetType = media.type || "application/octet-stream";
    }

    if (!assetUri || !assetHttpUrl) {
      return {
        ok: false,
        error: "Upload a media file to continue into preview.",
      };
    }

    const fallbackCaptureStart = existingDraft?.captureStartedAt || new Date().toISOString();
    const captureStartedAt = toIsoOrFallback(String(form.captureStartedAt ?? ""), fallbackCaptureStart);
    const captureEndedAt = toIsoOrFallback(String(form.captureEndedAt ?? ""), new Date().toISOString());

    if (new Date(captureEndedAt).getTime() < new Date(captureStartedAt).getTime()) {
      return {
        ok: false,
        error: "Capture end time must be equal to or later than the capture start time.",
      };
    }

    await upsertLegalchainDraft({
      userId: user.id,
      title: String(form.title ?? "").trim() || template.title,
      description: String(form.description ?? "").trim() || template.summary,
      templateSlug: template.slug,
      templateTitle: template.title,
      duration: String(form.duration ?? "").trim() || template.duration,
      visibility: String(form.visibility ?? "Private").trim() || "Private",
      assetUri,
      assetHttpUrl,
      assetName,
      assetType,
      captureStartedAt,
      captureEndedAt,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The media file could not be processed. Try another supported format.",
    };
  }

  throw event.redirect(302, "/preview");
});

export default component$(() => {
  const { draft, templates, selectedTemplate } = useRecordLoader().value;
  const draftAction = useRecordDraftAction();
  const templateRows: LegalchainTemplateRecord[] = templates;
  const existingDraft = draft ?? null;
  const initialTemplate =
    selectedTemplate ??
    getTemplateBySlug(templateRows, existingDraft?.templateSlug || "") ??
    templateRows[0] ??
    fallbackTemplate;

  const selectedTemplateSlug = useSignal(initialTemplate.slug);
  const titleValue = useSignal(existingDraft?.title || initialTemplate.title);
  const descriptionValue = useSignal(existingDraft?.description || initialTemplate.summary);
  const durationValue = useSignal(existingDraft?.duration || initialTemplate.duration);
  const visibilityValue = useSignal(existingDraft?.visibility || "Private");
  const captureStartedAt = useSignal(existingDraft?.captureStartedAt || "");
  const captureEndedAt = useSignal(existingDraft?.captureEndedAt || "");

  const formRef = useSignal<HTMLFormElement>();
  const fileInputRef = useSignal<HTMLInputElement>();
  const liveVideoRef = useSignal<HTMLVideoElement>();
  const teleprompterViewportRef = useSignal<HTMLDivElement>();
  const teleprompterTextRef = useSignal<HTMLDivElement>();
  const capturedFile = useSignal<NoSerialize<File>>();
  const controls = useSignal<NoSerialize<RecorderControls>>();

  const recorderState = useStore({
    modePrivate: false,
    supportsRecorder: false,
    cameraStatus: "Ready to start",
    teleprompterStatus: "Ready",
    recorderStatus: "idle" as RecorderStatus,
    selectedPresetSeconds: 180,
    countdownSeconds: 3,
    elapsedSeconds: 0,
    remainingSeconds: 180,
    localPreviewUrl: "",
    localAssetType: "",
    localAssetName: "",
    localSource: "",
    error: "",
    info: existingDraft ? "Current draft loaded from Turso." : "Choose a template and start a new take or upload one.",
    mimeType: "",
    teleprompterOffset: 0,
  });

  const activeTemplate =
    getTemplateBySlug(templateRows, selectedTemplateSlug.value) ??
    templateRows[0] ??
    fallbackTemplate;
  const checklistItems = buildChecklistItems(activeTemplate);
  const flowItems = buildFlowItems(activeTemplate);
  const teleprompterText = buildTeleprompterText(activeTemplate);
  const previewAssetType = recorderState.localAssetType || existingDraft?.assetType || "";
  const previewAssetName = recorderState.localAssetName || existingDraft?.assetName || "Stored asset";
  const previewSource = recorderState.localSource || (existingDraft ? "Saved draft" : "No asset yet");
  const previewUrl = recorderState.localPreviewUrl || existingDraft?.assetHttpUrl || "";
  const displayTimer =
    recorderState.recorderStatus === "countdown"
      ? `00:0${Math.max(0, recorderState.countdownSeconds)}`
      : recorderState.modePrivate
        ? formatClock(recorderState.elapsedSeconds)
        : recorderState.recorderStatus === "recording" || recorderState.recorderStatus === "paused"
          ? formatClock(recorderState.remainingSeconds)
          : normalizeDurationLabel(recorderState.selectedPresetSeconds);
  const stageSecondaryButtonClass =
    "rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/[0.03] disabled:text-white/30 disabled:opacity-100";

  useVisibleTask$(({ cleanup }) => {
    let stream: MediaStream | undefined;
    let mediaRecorder: MediaRecorder | undefined;
    let recordedChunks: Blob[] = [];
    let countdownTimer: number | undefined;
    let elapsedTimer: number | undefined;
    let teleprompterTimer: number | undefined;
    let teleprompterDelay: number | undefined;

    const stopCountdown = () => {
      if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = undefined;
      }
    };

    const stopElapsedTimer = () => {
      if (elapsedTimer) {
        window.clearInterval(elapsedTimer);
        elapsedTimer = undefined;
      }
    };

    const stopTeleprompter = () => {
      if (teleprompterDelay) {
        window.clearTimeout(teleprompterDelay);
        teleprompterDelay = undefined;
      }
      if (teleprompterTimer) {
        window.clearInterval(teleprompterTimer);
        teleprompterTimer = undefined;
      }
    };

    const clearLocalPreview = () => {
      revokeLocalUrl(recorderState.localPreviewUrl);
      recorderState.localPreviewUrl = "";
      recorderState.localAssetType = "";
      recorderState.localAssetName = "";
      recorderState.localSource = "";
    };

    const attachStreamToVideo = async () => {
      if (!stream || !liveVideoRef.value) {
        return;
      }

      liveVideoRef.value.srcObject = stream;
      liveVideoRef.value.muted = true;
      liveVideoRef.value.playsInline = true;

      try {
        await liveVideoRef.value.play();
      } catch {
        // Ignore autoplay blockers.
      }
    };

    const ensureStream = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        recorderState.supportsRecorder = false;
        recorderState.cameraStatus = "Upload only";
        recorderState.error = "This browser does not support in-browser capture. Upload a file instead.";
        return;
      }

      recorderState.supportsRecorder = true;
      recorderState.mimeType = resolveRecorderMimeType();

      if (stream) {
        await attachStreamToVideo();
        recorderState.cameraStatus = "Camera ready";
        return;
      }

      recorderState.cameraStatus = "Requesting access";
      recorderState.error = "";

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        await attachStreamToVideo();
        recorderState.cameraStatus = "Camera ready";
        recorderState.error = "";
      } catch (error) {
        recorderState.cameraStatus = "Access blocked";
        recorderState.error =
          error instanceof Error
            ? error.message
            : "Camera or microphone access was blocked. You can still upload a file.";
      }
    };

    const detectRecorderSupport = () => {
      const supported = Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
      recorderState.supportsRecorder = supported;
      recorderState.mimeType = supported ? resolveRecorderMimeType() : "";

      if (supported) {
        recorderState.cameraStatus = stream ? "Camera ready" : "Ready to start";
        return;
      }

      recorderState.cameraStatus = "Upload only";
    };

    const startTeleprompter = (delayMs = 0) => {
      stopTeleprompter();
      recorderState.teleprompterStatus = "Scrolling";
      teleprompterDelay = window.setTimeout(() => {
        teleprompterTimer = window.setInterval(() => {
          const viewport = teleprompterViewportRef.value;
          const content = teleprompterTextRef.value;
          if (!viewport || !content) {
            return;
          }

          const maxOffset = Math.max(content.scrollHeight - viewport.clientHeight + 60, 0);
          recorderState.teleprompterOffset =
            recorderState.teleprompterOffset >= maxOffset ? -40 : recorderState.teleprompterOffset + 1;
        }, 80);
      }, delayMs);
    };

    const startElapsedClock = () => {
      stopElapsedTimer();
      elapsedTimer = window.setInterval(() => {
        if (recorderState.modePrivate) {
          recorderState.elapsedSeconds += 1;
          durationValue.value = normalizeDurationLabel(recorderState.elapsedSeconds);
          return;
        }

        recorderState.elapsedSeconds += 1;
        recorderState.remainingSeconds = Math.max(recorderState.selectedPresetSeconds - recorderState.elapsedSeconds, 0);
        durationValue.value = normalizeDurationLabel(recorderState.elapsedSeconds);

        if (recorderState.remainingSeconds <= 0) {
          stopCapture();
        }
      }, 1000);
    };

    const finalizeCapture = () => {
      stopElapsedTimer();
      stopTeleprompter();

      const finalMimeType = recorderState.mimeType || recordedChunks[0]?.type || "video/webm";
      const blob = new Blob(recordedChunks, { type: finalMimeType });
      recordedChunks = [];

      if (blob.size === 0) {
        recorderState.recorderStatus = "idle";
        recorderState.cameraStatus = stream ? "Camera ready" : "Upload only";
        recorderState.teleprompterStatus = "Ready";
        recorderState.error = "No media was captured. Try recording again or upload a file instead.";
        return;
      }

      const extension = finalMimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `${selectedTemplateSlug.value || "legalchain-record"}-${Date.now()}.${extension}`, {
        type: finalMimeType,
      });

      capturedFile.value = noSerialize(file);
      clearLocalPreview();
      recorderState.localPreviewUrl = URL.createObjectURL(file);
      recorderState.localAssetType = finalMimeType;
      recorderState.localAssetName = file.name;
      recorderState.localSource = "Captured take";
      captureEndedAt.value = new Date().toISOString();
      durationValue.value = normalizeDurationLabel(Math.max(recorderState.elapsedSeconds, 1));
      recorderState.recorderStatus = "ready";
      recorderState.cameraStatus = "Capture ready";
      recorderState.teleprompterStatus = "Ready";
      recorderState.info = "Captured take ready. Save it to preview or record another pass.";
    };

    const beginRecording = async () => {
      await ensureStream();
      if (!stream) {
        return;
      }

      clearLocalPreview();
      capturedFile.value = undefined;
      recorderState.error = "";
      recorderState.info = "Recording started.";
      recorderState.teleprompterOffset = 0;
      recorderState.elapsedSeconds = 0;
      recorderState.remainingSeconds = recorderState.selectedPresetSeconds;
      captureStartedAt.value = new Date().toISOString();
      captureEndedAt.value = "";
      durationValue.value = normalizeDurationLabel(recorderState.modePrivate ? 0 : recorderState.selectedPresetSeconds);

      const recorderOptions = recorderState.mimeType
        ? {
            mimeType: recorderState.mimeType,
            videoBitsPerSecond: 8_000_000,
            audioBitsPerSecond: 128_000,
          }
        : undefined;

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      mediaRecorder.onstop = finalizeCapture;
      mediaRecorder.start(200);

      recorderState.recorderStatus = "recording";
      recorderState.cameraStatus = "Recording";
      recorderState.teleprompterStatus = "Scrolling";
      startElapsedClock();
      startTeleprompter(120);
    };

    const stopCapture = () => {
      stopCountdown();

      if (recorderState.recorderStatus === "countdown") {
        recorderState.recorderStatus = "idle";
        recorderState.cameraStatus = stream ? "Camera ready" : "Upload only";
        recorderState.teleprompterStatus = "Ready";
        recorderState.info = "Countdown cancelled.";
        return;
      }

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        stopElapsedTimer();
        stopTeleprompter();
        recorderState.cameraStatus = "Finalizing";
        recorderState.teleprompterStatus = "Ready";
        recorderState.info = "Finalizing the take...";
        mediaRecorder.stop();
      }
    };

    controls.value = noSerialize<RecorderControls>({
      ensureStream,
      syncSelectedFile: (file, sourceLabel = "Selected upload") => {
        capturedFile.value = undefined;
        clearLocalPreview();

        if (!file) {
          recorderState.info = existingDraft ? "Current draft loaded from Turso." : "No local file selected yet.";
          return;
        }

        recorderState.localPreviewUrl = URL.createObjectURL(file);
        recorderState.localAssetType = file.type || "application/octet-stream";
        recorderState.localAssetName = file.name;
        recorderState.localSource = sourceLabel;
        recorderState.info = `${sourceLabel} ready for review before preview.`;
        recorderState.error = "";
        captureStartedAt.value = new Date().toISOString();
        captureEndedAt.value = captureStartedAt.value;
      },
      startCapture: async () => {
        await ensureStream();
        if (!stream) {
          return;
        }

        if (fileInputRef.value) {
          fileInputRef.value.value = "";
        }

        stopCountdown();
        stopElapsedTimer();
        stopTeleprompter();
        clearLocalPreview();
        capturedFile.value = undefined;
        recorderState.error = "";
        recorderState.info = "Countdown armed. Recording starts in 3 seconds.";
        recorderState.recorderStatus = "countdown";
        recorderState.countdownSeconds = 3;
        recorderState.teleprompterOffset = 0;
        recorderState.teleprompterStatus = "Queued";
        recorderState.cameraStatus = "Countdown";
        captureStartedAt.value = "";
        captureEndedAt.value = "";

        countdownTimer = window.setInterval(() => {
          if (recorderState.countdownSeconds <= 1) {
            stopCountdown();
            recorderState.countdownSeconds = 0;
            void beginRecording();
            return;
          }

          recorderState.countdownSeconds -= 1;
        }, 1000);
      },
      pauseCapture: () => {
        if (!mediaRecorder || mediaRecorder.state !== "recording") {
          return;
        }

        mediaRecorder.pause();
        stopElapsedTimer();
        stopTeleprompter();
        recorderState.recorderStatus = "paused";
        recorderState.cameraStatus = "Paused";
        recorderState.teleprompterStatus = "Paused";
        recorderState.info = "Capture paused. Resume when the witness is ready.";
      },
      resumeCapture: () => {
        if (!mediaRecorder || mediaRecorder.state !== "paused") {
          return;
        }

        mediaRecorder.resume();
        recorderState.recorderStatus = "recording";
        recorderState.cameraStatus = "Recording";
        recorderState.teleprompterStatus = "Scrolling";
        recorderState.info = "Capture resumed.";
        startElapsedClock();
        startTeleprompter(120);
      },
      stopCapture,
      saveCaptureToForm: () => {
        const file = capturedFile.value;
        if (!file || !fileInputRef.value || !formRef.value) {
          recorderState.error = "No recorded take is ready to save yet.";
          return;
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.value.files = dataTransfer.files;
        recorderState.recorderStatus = "submitting";
        recorderState.info = "Saving captured take and moving to preview...";
        formRef.value.requestSubmit();
      },
    });

    detectRecorderSupport();

    cleanup(() => {
      stopCountdown();
      stopElapsedTimer();
      stopTeleprompter();

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      clearLocalPreview();
      controls.value = undefined;
    });
  });

  const saveCapturedTake$ = $(async () => {
    controls.value?.saveCaptureToForm();
  });

  return (
    <LegalchainPageShell
      eyebrow="Private route"
      title="Record"
      description="The recording route now mirrors the original Legalchain flow: live camera stage, teleprompter, timed capture modes and the same preview handoff."
      actions={[
        { label: "Preview result", href: "/preview" },
        { label: "Open history", href: "/history" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          { label: "Selected template", value: activeTemplate.title, hint: "Current capture script from Turso." },
          { label: "Mode", value: recorderState.modePrivate ? "Private" : "Timed", hint: "Private counts up. Timed sessions stop automatically." },
          {
            label: "Teleprompter",
            value: recorderState.teleprompterStatus,
            hint: `${activeTemplate.scriptBlocks.length || 1} script segment(s) loaded for the witness prompt.`,
          },
          {
            label: "Camera",
            value: recorderState.cameraStatus,
            hint: recorderState.supportsRecorder
              ? "Browser capture is available alongside manual uploads."
              : "Fallback upload stays available when camera APIs are blocked.",
          },
        ]}
      />
      <div class="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
        <div class="space-y-6">
          <LegalchainPanel
            eyebrow="Template selector"
            title="Capture script"
            description="Select the live template, review its operational context and save the take into preview using the same draft action."
          >
            <Form ref={formRef} action={draftAction} enctype="multipart/form-data" class="space-y-4">
              <div class="rounded-[22px] border border-white/10 bg-[#0d0713]/88 px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.22em] text-white/40">Live brief</div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <LegalchainPill label={activeTemplate.category} tone="light" />
                  <LegalchainPill label={activeTemplate.status} />
                  <LegalchainPill label={activeTemplate.audience || "Legal ops"} />
                </div>
                <p class="mt-4 text-sm leading-7 text-white/62">{activeTemplate.summary}</p>
              </div>

              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Template</div>
                <select
                  name="templateSlug"
                  value={selectedTemplateSlug.value}
                  onInput$={(_, currentTarget) => {
                    const currentTemplate = getTemplateBySlug(templateRows, selectedTemplateSlug.value) ?? activeTemplate;
                    const nextTemplate = getTemplateBySlug(templateRows, currentTarget.value) ?? fallbackTemplate;
                    selectedTemplateSlug.value = nextTemplate.slug;

                    if (titleValue.value === currentTemplate.title || !titleValue.value.trim()) {
                      titleValue.value = nextTemplate.title;
                    }
                    if (descriptionValue.value === currentTemplate.summary || !descriptionValue.value.trim()) {
                      descriptionValue.value = nextTemplate.summary;
                    }
                    if (durationValue.value === currentTemplate.duration || !durationValue.value.trim()) {
                      durationValue.value = nextTemplate.duration;
                    }
                  }}
                  class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                >
                  {templateRows.map((template: LegalchainTemplateRecord) => (
                    <option key={template.slug} value={template.slug}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>

              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Record title</div>
                <input
                  name="title"
                  value={titleValue.value}
                  onInput$={(_, currentTarget) => {
                    titleValue.value = currentTarget.value;
                  }}
                  class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Description</div>
                <textarea
                  name="description"
                  rows={4}
                  value={descriptionValue.value}
                  onInput$={(_, currentTarget) => {
                    descriptionValue.value = currentTarget.value;
                  }}
                  class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Duration</div>
                  <input
                    name="duration"
                    value={durationValue.value}
                    onInput$={(_, currentTarget) => {
                      durationValue.value = currentTarget.value;
                    }}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label class="block">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Visibility</div>
                  <select
                    name="visibility"
                    value={visibilityValue.value}
                    onInput$={(_, currentTarget) => {
                      visibilityValue.value = currentTarget.value;
                    }}
                    class="w-full rounded-[18px] border border-white/10 bg-[#0d0713]/88 px-4 py-3 text-sm text-white outline-none"
                  >
                    {["Private", "Internal", "Shared"].map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {visibility}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <input type="hidden" name="captureStartedAt" value={captureStartedAt.value} />
              <input type="hidden" name="captureEndedAt" value={captureEndedAt.value} />

              <div class="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div class="text-[10px] uppercase tracking-[0.22em] text-white/40">Capture window</div>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div class="text-[10px] uppercase tracking-[0.22em] text-white/34">Started</div>
                    <div class="mt-2 text-sm leading-6 text-white/72">
                      {captureStartedAt.value || existingDraft?.captureStartedAt || "Generated automatically when the take starts."}
                    </div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-[0.22em] text-white/34">Ended</div>
                    <div class="mt-2 text-sm leading-6 text-white/72">
                      {captureEndedAt.value || existingDraft?.captureEndedAt || "Generated automatically when the take ends."}
                    </div>
                  </div>
                </div>
              </div>

              <label class="block">
                <div class="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">Manual media upload</div>
                <input
                  ref={fileInputRef}
                  name="media"
                  type="file"
                  accept="video/*,audio/*,application/pdf"
                  onChange$={(_, currentTarget) => {
                    controls.value?.syncSelectedFile(currentTarget.files?.[0] ?? null, "Selected upload");
                  }}
                  class="block w-full rounded-[18px] border border-dashed border-white/14 bg-[#0d0713]/88 px-4 py-4 text-sm text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.2em] file:text-[#7e0f84]"
                />
                <p class="mt-2 text-xs leading-6 text-white/46">
                  Upload remains available for audio-only evidence and documents. Camera capture uses the same save action when you choose “Save captured take”.
                </p>
              </label>

              {existingDraft && !recorderState.localPreviewUrl && (
                <div class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4 text-sm leading-7 text-white/62">
                  Current draft asset: {existingDraft.assetName || "Stored asset"}.
                  {" "}
                  <a href={existingDraft.assetHttpUrl} target="_blank" rel="noreferrer" class="font-semibold text-white">
                    Open current upload
                  </a>
                </div>
              )}

              {recorderState.info && (
                <div class="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/74">
                  {recorderState.info}
                </div>
              )}

              {(recorderState.error || (draftAction.value && !draftAction.value.ok)) && (
                <div class="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {recorderState.error || draftAction.value?.error}
                </div>
              )}

              <button
                type="submit"
                class="w-full rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                {draftAction.isRunning ? "Saving draft..." : "Save upload and open preview"}
              </button>
            </Form>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Session setup" title="Before pressing record">
            <LegalchainChecklist items={checklistItems} />
          </LegalchainPanel>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="lg:col-span-2">
            <LegalchainPanel eyebrow="Stage" title="Camera and teleprompter">
              <div class="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.72fr)_minmax(340px,1.28fr)]">
                <div class="min-w-0 rounded-[28px] border border-white/10 bg-[#09050e] p-4 lg:p-5">
                {(recorderState.recorderStatus === "countdown" ||
                  recorderState.recorderStatus === "recording" ||
                  recorderState.recorderStatus === "paused") && recorderState.supportsRecorder ? (
                  <div class="relative overflow-hidden rounded-[24px] border border-white/10 bg-black">
                    <video
                      ref={liveVideoRef}
                      class="min-h-[280px] w-full object-cover lg:min-h-[320px] xl:min-h-[380px]"
                      autoplay
                      muted
                      playsInline
                    />
                    <div class="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white">
                      {recorderState.recorderStatus === "countdown"
                        ? `Starting in ${recorderState.countdownSeconds}`
                        : recorderState.recorderStatus === "paused"
                          ? "Paused"
                          : "Recording"}
                    </div>
                  </div>
                ) : previewAssetType.startsWith("video/") && previewUrl ? (
                  <video
                    class="min-h-[280px] w-full rounded-[24px] border border-white/10 object-cover lg:min-h-[320px] xl:min-h-[380px]"
                    controls
                    src={previewUrl}
                  />
                ) : previewAssetType.startsWith("audio/") && previewUrl ? (
                  <div class="grid min-h-[280px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 lg:min-h-[320px] xl:min-h-[380px]">
                    <div class="w-full max-w-lg space-y-5 text-center">
                      <div class="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white text-2xl font-black uppercase tracking-[0.24em] text-[#7e0f84]">
                        Aud
                      </div>
                      <div class="text-xl font-black text-white">Audio evidence ready</div>
                      <audio class="w-full" controls src={previewUrl} />
                    </div>
                  </div>
                ) : previewAssetType === "application/pdf" && previewUrl ? (
                  <div class="grid min-h-[280px] place-items-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 text-center lg:min-h-[320px] xl:min-h-[380px]">
                    <div class="space-y-4">
                      <div class="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white text-2xl font-black uppercase tracking-[0.24em] text-[#7e0f84]">
                        PDF
                      </div>
                      <div class="text-xl font-black text-white">Document evidence uploaded</div>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                      >
                        Open document
                      </a>
                    </div>
                  </div>
                ) : (
                  <div class="grid min-h-[280px] place-items-center rounded-[24px] border border-dashed border-white/15 bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] lg:min-h-[320px] xl:min-h-[380px]">
                    <div class="text-center">
                      <div class="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white text-2xl font-black uppercase tracking-[0.24em] text-[#7e0f84]">
                        Rec
                      </div>
                      <div class="mt-4 text-xl font-black text-white">Recording stage</div>
                      <p class="mt-3 max-w-md text-sm leading-7 text-white/62">
                        Press Start recording to request camera access, or upload a video, audio file or PDF on the left.
                      </p>
                    </div>
                  </div>
                )}

                <div class="mt-4 flex flex-wrap gap-3">
                  {[
                    ["Clock", displayTimer],
                    ["Asset", previewAssetType || "Pending asset"],
                    ["Source", previewSource],
                  ].map(([label, value]) => (
                    <div key={label} class="min-w-[112px] flex-1 rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                      <div class="text-[10px] uppercase tracking-[0.22em] text-white/36">{label}</div>
                      <div class="mt-2 text-sm font-semibold text-white/80">{value}</div>
                    </div>
                  ))}
                </div>

                <div class="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick$={() => {
                      recorderState.modePrivate = !recorderState.modePrivate;
                      recorderState.info = recorderState.modePrivate
                        ? "Private mode enabled. The timer will count up until you stop."
                        : "Timed mode enabled. The timer will count down to zero.";
                    }}
                    class={[
                      "rounded-full px-4 py-3 text-sm font-black uppercase tracking-[0.22em]",
                      recorderState.modePrivate
                        ? "bg-white text-[#7e0f84]"
                        : "border border-white/12 bg-white/[0.08] text-white",
                    ]}
                  >
                    Private mode
                  </button>

                  {[180, 60, 15].map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick$={() => {
                        recorderState.selectedPresetSeconds = seconds;
                        recorderState.remainingSeconds = seconds;
                        if (recorderState.recorderStatus === "idle" || recorderState.recorderStatus === "ready") {
                          durationValue.value = normalizeDurationLabel(seconds);
                        }
                      }}
                      class={[
                        "rounded-full px-4 py-3 text-sm font-black uppercase tracking-[0.22em]",
                        recorderState.selectedPresetSeconds === seconds
                          ? "bg-white text-[#7e0f84]"
                          : "border border-white/12 bg-white/[0.08] text-white",
                      ]}
                    >
                      {seconds === 180 ? "3m" : `${seconds}s`}
                    </button>
                  ))}
                </div>

                <div class="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    data-no-loader="true"
                    onClick$={async () => {
                      await controls.value?.startCapture();
                    }}
                    class="rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                  >
                    {recorderState.recorderStatus === "ready" ? "Record again" : "Start recording"}
                  </button>

                  <button
                    type="button"
                    data-no-loader="true"
                    onClick$={() => {
                      controls.value?.pauseCapture();
                    }}
                    disabled={recorderState.recorderStatus !== "recording"}
                    class={stageSecondaryButtonClass}
                  >
                    Pause
                  </button>

                  <button
                    type="button"
                    data-no-loader="true"
                    onClick$={() => {
                      controls.value?.resumeCapture();
                    }}
                    disabled={recorderState.recorderStatus !== "paused"}
                    class={stageSecondaryButtonClass}
                  >
                    Resume
                  </button>

                  <button
                    type="button"
                    data-no-loader="true"
                    onClick$={() => {
                      controls.value?.stopCapture();
                    }}
                    disabled={!["countdown", "recording", "paused"].includes(recorderState.recorderStatus)}
                    class={stageSecondaryButtonClass}
                  >
                    Stop
                  </button>

                  <button
                    type="button"
                    data-no-loader="true"
                    onClick$={saveCapturedTake$}
                    disabled={!capturedFile.value || draftAction.isRunning}
                    class={stageSecondaryButtonClass}
                  >
                    Save captured take
                  </button>
                </div>
              </div>

                <div class="min-w-0 rounded-[28px] border border-white/10 bg-[#09050e] p-4 lg:p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="text-[10px] uppercase tracking-[0.22em] text-white/42">Teleprompter</div>
                    <div class="mt-2 text-xl font-black text-white">{activeTemplate.title}</div>
                  </div>
                  <LegalchainPill
                    label={recorderState.teleprompterStatus}
                    tone={recorderState.teleprompterStatus === "Scrolling" ? "light" : "default"}
                  />
                </div>
                <p class="mt-3 text-sm leading-7 text-white/60">
                  The script below scrolls live while the camera is recording or after the session resumes.
                </p>
                <div
                  ref={teleprompterViewportRef}
                  class="mt-5 h-[280px] overflow-hidden rounded-[24px] border border-white/10 bg-black/35 p-5 lg:h-[320px] xl:h-[380px]"
                >
                  <div
                    ref={teleprompterTextRef}
                    class="whitespace-pre-wrap text-center text-base font-semibold leading-[1.75] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] transition-transform duration-75 lg:text-lg xl:text-xl"
                    style={{ transform: `translateY(-${recorderState.teleprompterOffset}px)` }}
                  >
                    {teleprompterText}
                  </div>
                </div>
              </div>
              </div>
            </LegalchainPanel>
          </div>

          <LegalchainPanel eyebrow="Flow" title="Prompt order">
            <LegalchainChecklist items={flowItems} />
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Metadata" title="Current take">
            <div class="space-y-3">
              {[
                ["Template slug", activeTemplate.slug],
                ["Asset name", previewAssetName],
                ["Capture started", captureStartedAt.value || existingDraft?.captureStartedAt || "Waiting for capture"],
                ["Capture ended", captureEndedAt.value || existingDraft?.captureEndedAt || "Waiting for stop"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  class="flex items-start justify-between gap-4 rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3"
                >
                  <div class="text-[11px] font-black uppercase tracking-[0.22em] text-white/42">{label}</div>
                  <div class="text-right text-sm text-white/78">{value}</div>
                </div>
              ))}
            </div>
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});
