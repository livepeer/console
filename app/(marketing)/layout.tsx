import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/**
 * Marketing route group layout — wraps every marketing route (homepage,
 * /blog, /brand, /ecosystem, /foundation, /primer, /token, /use-cases) with
 * the public Header + Footer. The dashboard route groups ((dashboard) /
 * (dashboard-auth)) have their own layouts and intentionally do NOT inherit
 * this chrome.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
