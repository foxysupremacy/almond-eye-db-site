import { CollectionRouteFrame } from "@/features/collection/components/collection-route-frame";
import { CharactersView } from "@/features/collection";

export default function CharactersPage() {
  return <CollectionRouteFrame activeRoute="characters"><CharactersView /></CollectionRouteFrame>;
}
