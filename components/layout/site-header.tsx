import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Image
            src="/map/logo.svg"
            alt="FoundIt"
            width={140}
            height={38}
            priority
            className="h-10 w-auto"
          />
          <span className="font-headline text-xl font-extralight tracking-[-0.04em] text-primary">
            찾았독
          </span>
        </Link>
        {/* Login button removed */}
      </div>
    </header>
  );
}
