"use client";

import { LegalPage } from "@/components/legal-page";
import { PROCESSOR } from "@/lib/legal";

export default function Page() {
  return <LegalPage doc={PROCESSOR} />;
}
