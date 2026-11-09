/** Background jobs carry error codes rather than the synchronous provider error message. */
export function providerBudgetMessage(code: string | null | undefined) {
  if (code === "provider_budget_exhausted")
    return "The app's API allowance is exhausted. Saved results remain available; try again after the allowance resets.";
  if (code === "provider_budget_unavailable")
    return "API usage protection is temporarily unavailable. New requests are paused; saved results remain available.";
  return undefined;
}
