"use client";

import { LegalPage } from "@/components/legal-page";
import { TERMS } from "@/lib/legal";

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
