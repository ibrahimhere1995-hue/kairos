import { invoke } from "@tauri-apps/api/core";
import type { OnboardingInput } from "@/types/OnboardingInput";
import type { OnboardingStatus } from "@/types/OnboardingStatus";

/** Typed wrappers for src-tauri/src/commands/onboarding.rs. */
export const onboardingApi = {
  status: () => invoke<OnboardingStatus>("get_onboarding"),
  finish: (input: OnboardingInput) => invoke<OnboardingStatus>("finish_onboarding", { input }),
  skip: () => invoke<OnboardingStatus>("skip_onboarding"),
  removeSamples: () => invoke<number>("remove_sample_tasks"),
};
