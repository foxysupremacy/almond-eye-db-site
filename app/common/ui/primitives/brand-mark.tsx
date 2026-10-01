export function BrandMark({ className = "" }: { className?: string }) {
  return <img src="/assets/icon.png" alt="" width={40} height={40} className={`h-8 w-8 shrink-0 object-contain lg:h-10 lg:w-10 ${className}`} />;
}
