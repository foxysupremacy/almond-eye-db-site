import type { Metadata } from "next";
import { LandingFeature, loadLandingData } from "@/features/landing";

export const metadata: Metadata = {
  title: "AlmondEye DB | Build your deck. Know your race.",
  description: "Plan Uma Musume support decks, trace inheritance, and explore skill activation zones. Try the interactive race track demo and start your next build.",
};

export default async function LandingPage() {
  return <LandingFeature data={await loadLandingData()} />;
}
