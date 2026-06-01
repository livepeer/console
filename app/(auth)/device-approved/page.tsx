import Link from "next/link";
import { LivepeerSymbol } from "@/components/design-system/LivepeerLogo";

export default function DeviceApprovedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-dark px-6">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-dark-card p-8 text-center">
        <div className="mb-5 flex justify-center">
          <LivepeerSymbol className="h-9 w-9" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Device login approved
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          You can return to your terminal. The python-gateway device flow should
          finish automatically in a few seconds.
        </p>
        <div className="mt-6">
          <Link
            href="/home"
            className="inline-flex rounded-full bg-green-bright px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-light"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
