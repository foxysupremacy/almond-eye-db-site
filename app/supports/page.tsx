import { CollectionRouteFrame } from "@/features/collection/components/collection-route-frame";
import { SupportsView } from "@/features/collection";

export default function SupportsPage() {
  return <CollectionRouteFrame activeRoute="supports"><SupportsView /></CollectionRouteFrame>;
}
