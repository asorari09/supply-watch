"use server";

import { revalidatePath } from "next/cache";

import { approveDraft, rejectDraft } from "@/lib/comms/approval";
import { sendDraft } from "@/lib/comms/send";
import { env } from "@/lib/config/env";
import {
  injectSyntheticDisruption,
  type DemoInjectionSummary,
} from "@/lib/dashboard/inject-demo";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";

export type DraftActionResult =
  | { ok: true; status: "approved" | "rejected" | "sent" }
  | { ok: false; error: string };

export type InjectActionResult =
  { ok: true; summary: DemoInjectionSummary } | { ok: false; error: string };

const revalidateDashboard = (): void => {
  revalidatePath("/dashboard");
};

export const approveDraftAction = async (
  draftId: string,
  editedBody?: string,
): Promise<DraftActionResult> => {
  try {
    const result = await approveDraft(
      createSupabaseAdminClient(),
      draftId,
      env.APPROVER_NAME ?? "Operations Reviewer",
      editedBody,
    );
    if (!result.ok)
      return {
        ok: false,
        error:
          result.reason === "not pending"
            ? "This draft is no longer pending review."
            : "Unable to approve this draft.",
      };
    revalidateDashboard();
    return { ok: true, status: "approved" };
  } catch {
    return { ok: false, error: "Unable to approve this draft." };
  }
};

export const rejectDraftAction = async (
  draftId: string,
): Promise<DraftActionResult> => {
  try {
    const result = await rejectDraft(
      createSupabaseAdminClient(),
      draftId,
      env.APPROVER_NAME ?? "Operations Reviewer",
    );
    if (!result.ok)
      return {
        ok: false,
        error:
          result.reason === "not pending"
            ? "This draft is no longer pending review."
            : "Unable to reject this draft.",
      };
    revalidateDashboard();
    return { ok: true, status: "rejected" };
  } catch {
    return { ok: false, error: "Unable to reject this draft." };
  }
};

export const sendDraftAction = async (
  draftId: string,
): Promise<DraftActionResult> => {
  try {
    const result = await sendDraft(createSupabaseAdminClient(), draftId);
    if (!result.ok)
      return {
        ok: false,
        error:
          result.reason === "not approved"
            ? "This draft must be approved before it can be sent."
            : "Unable to send this draft.",
      };
    revalidateDashboard();
    return { ok: true, status: "sent" };
  } catch {
    return { ok: false, error: "Unable to send this draft." };
  }
};

export const injectDisruptionAction = async (): Promise<InjectActionResult> => {
  try {
    const summary = await injectSyntheticDisruption();
    revalidateDashboard();
    return { ok: true, summary };
  } catch {
    return {
      ok: false,
      error: "Unable to inject the synthetic demo scenario.",
    };
  }
};
