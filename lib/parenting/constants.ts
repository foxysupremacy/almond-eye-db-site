/** Helper to compute rank letter box for a base stat */
export function getStatRankBadge(val: number): { rank: string; bgClass: string } {
  if (val < 50) return { rank: "G", bgClass: "bg-zinc-500 text-white" };
  if (val < 100) return { rank: "G+", bgClass: "bg-zinc-600 text-white" };
  if (val < 150) return { rank: "F", bgClass: "bg-purple-700 text-white" };
  if (val < 200) return { rank: "F+", bgClass: "bg-purple-800 text-white" };
  if (val < 300) return { rank: "E", bgClass: "bg-indigo-600 text-white" };
  if (val < 400) return { rank: "D", bgClass: "bg-emerald-600 text-white" };
  if (val < 500) return { rank: "C", bgClass: "bg-amber-400 text-amber-950" };
  if (val < 600) return { rank: "B", bgClass: "bg-pink-600 text-white" };
  if (val < 800) return { rank: "A", bgClass: "bg-orange-600 text-white" };
  return { rank: "S", bgClass: "bg-yellow-400 text-yellow-950" };
}

/** Helper to style Umamusume aptitude letter grades */
export function getAptitudeStyle(grade?: string): string {
  switch (grade?.toUpperCase()) {
    case "S":
      return "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-black border border-yellow-200 shadow-2xs";
    case "A":
      return "bg-gradient-to-b from-orange-500 to-red-500 text-white font-black border border-orange-400 shadow-2xs";
    case "B":
      return "bg-gradient-to-b from-pink-500 to-rose-600 text-white font-black border border-pink-400 shadow-2xs";
    case "C":
      return "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 font-black border border-amber-300 shadow-2xs";
    case "D":
      return "bg-gradient-to-b from-emerald-500 to-teal-600 text-white font-black border border-emerald-400 shadow-2xs";
    case "E":
      return "bg-gradient-to-b from-indigo-500 to-blue-600 text-white font-black border border-indigo-400 shadow-2xs";
    case "F":
      return "bg-gradient-to-b from-purple-500 to-violet-700 text-white font-black border border-purple-400 shadow-2xs";
    case "G":
    default:
      return "bg-gradient-to-b from-zinc-400 to-zinc-600 text-white font-black border border-zinc-300 shadow-2xs";
  }
}
