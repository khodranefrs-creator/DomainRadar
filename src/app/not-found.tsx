import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="px-6 py-16 lg:px-10">
      <div className="pill-eyebrow mb-4">Off the map</div>
      <h1 className="display">
        That route resolves to <em>nothing</em>.
      </h1>
      <p className="lede mt-4">
        There is no record here — and this product will not invent one. Pick a real
        surface below and the desk will answer with evidence.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Link href="/" className="btn btn-primary">
          <Icon name="console" size={15} />
          Back to console
        </Link>
        <Link href="/scanner" className="btn">
          <Icon name="investigate" size={15} />
          Investigate a domain
        </Link>
        <Link href="/sources" className="btn btn-ghost">
          <Icon name="registry" size={15} />
          Registry coverage
        </Link>
      </div>

      <p className="micro mt-8 max-w-[62ch] leading-relaxed">
        A “no record” answer is never a claim that a domain is available to
        register. Run it against the registries to find out what is actually
        known.
      </p>
    </div>
  );
}
