import { CollectionRouteFrame } from "@/features/collection/components/collection-route-frame";
import { CharacterDetailRoute } from "@/features/collection/character-detail-route";

export default function CharacterDetailPage() {
  return <CollectionRouteFrame activeRoute="characters"><CharacterDetailRoute /></CollectionRouteFrame>;
}
