export type SubTab = "cards" | "characters";

export type CardTypeKey =
  | "all"
  | "speed"
  | "stamina"
  | "power"
  | "guts"
  | "intelligence"
  | "friend"
  | "group";

export type OwnershipFilter = "all" | "owned" | "unowned" | "maxed";

export const CARD_TYPES: CardTypeKey[] = [
  "all",
  "speed",
  "stamina",
  "power",
  "guts",
  "intelligence",
  "friend",
  "group",
];
