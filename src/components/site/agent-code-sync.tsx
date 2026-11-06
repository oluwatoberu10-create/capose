"use client";
import { useEffect } from "react";

/** Lets share buttons append the signed-in (approved) agent's referral code. */
export function AgentCodeSync({ code }: { code: string | null }) {
  useEffect(() => {
    try {
      if (code) localStorage.setItem("am_agent_code", code);
      else localStorage.removeItem("am_agent_code");
    } catch { /* ignore */ }
  }, [code]);
  return null;
}
