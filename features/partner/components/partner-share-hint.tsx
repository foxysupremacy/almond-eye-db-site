import { LinkIcon } from "@/app/common/ui/primitives/icons";

/** Discovery hint shown after a veterans import: where the Partner Card share lives. */
export function PartnerShareHint({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-xs ${className}`}>
      <LinkIcon className="h-4 w-4 flex-none text-emerald-700 dark:text-emerald-400" />
      <p className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-300">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Share a trained uma as a partner card.</span>{" "}
        Put it in Parent 1 or 2 on the Parenting tab, then press <strong>Share Parent</strong>. Friends can view it and borrow it.
      </p>
      <a
        href="/#parenting"
        onClick={onNavigate}
        className="inline-flex min-h-11 flex-none items-center font-semibold text-emerald-700 hover:underline md:min-h-0 dark:text-emerald-400"
      >
        Open Parenting
      </a>
    </div>
  );
}
