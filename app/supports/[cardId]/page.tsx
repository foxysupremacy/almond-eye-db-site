import { CollectionRouteFrame } from "@/features/collection/components/collection-route-frame";
import { SupportDetailRoute } from "@/features/collection/support-detail-route";

export default function SupportDetailPage() {
  return <CollectionRouteFrame activeRoute="supports"><SupportDetailRoute /></CollectionRouteFrame>;
}
