import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskIcon } from "@phosphor-icons/react/ssr";
import { Wordmark } from "@/components/ui/LogoMark";
import { StarMotif } from "@/components/ui/StarMotif";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Wordmark />
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="text-[32px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-[15px] text-muted">Administrator access to the university data warehouse.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <FlaskIcon size={15} weight="fill" className="text-accent" />
          All student, fee and result records in this system are simulated.
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-night p-12 text-[#fff8f5] lg:flex lg:flex-col">
        <StarMotif className="mx-auto mt-6 w-full max-w-[460px]" />
        <div className="mt-auto max-w-lg">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-series-2-dark">B.Sc. Computer Science project</p>
          <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">
            Design and Implementation of a Data Warehouse and Business Intelligence Dashboard for University Administration
          </h2>
          <p className="mt-3 text-[15px] text-night-muted">Ebonyi State University, Abakaliki. Three source systems, one star schema, one dashboard.</p>
        </div>
      </div>
    </main>
  );
}
