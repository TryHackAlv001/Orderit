import Link from "next/link";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Start Selling on Tradeloft", href: "/sell" },
  { label: "Help Center", href: "/help" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface text-text">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Tradeloft</h2>
            <p className="max-w-lg text-sm text-muted">
              Shop anything from verified local vendors with secure payments and fast delivery.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              <Link href="/about" className="transition-colors duration-200 hover:text-text">About</Link>
              <Link href="/contact" className="transition-colors duration-200 hover:text-text">Contact</Link>
              <Link href="/sell" className="transition-colors duration-200 hover:text-text">Start Selling on Tradeloft</Link>
              <Link href="/help" className="transition-colors duration-200 hover:text-text">Help Center</Link>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">Connect</p>
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              <a href="#" className="rounded-md bg-surface-raised px-4 py-3 transition-colors duration-200 hover:text-text">Facebook</a>
              <a href="#" className="rounded-md bg-surface-raised px-4 py-3 transition-colors duration-200 hover:text-text">Instagram</a>
              <a href="#" className="rounded-md bg-surface-raised px-4 py-3 transition-colors duration-200 hover:text-text">Twitter</a>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">Payments</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">Paystack</div>
              <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">Flutterwave</div>
              <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">Visa</div>
              <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">Mastercard</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Made with <span className="text-accent-text">❤️</span> for sellers and buyers worldwide</p>
          <p className="text-sm text-muted">© {new Date().getFullYear()} Tradeloft. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
