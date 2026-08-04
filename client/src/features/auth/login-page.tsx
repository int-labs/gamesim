import { AlertCircle, ArrowRight, Check, KeyRound, Mail } from "lucide-react";
import * as React from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { PasswordInput } from "@/features/auth/password-input";
import { login, type StaffUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Console sign-in.
 *
 * Two panels: the form on the left, the brand photograph on the right carrying
 * the wordmark and the positioning line. The photo already contains the Int
 * Labs swirl, so the panel adds only a navy scrim — no second brand device
 * competing with the one in the image.
 *
 * Every animation here is CSS (`.auth-rise` / `.auth-shake` in globals.css)
 * rather than Motion. Not because Motion is broken — it isn't — but because
 * sign-in is the one screen where a stalled animation means the user cannot
 * get in, so it should depend on as little as possible. The error message
 * below is deliberately not animated at all for the same reason.
 *
 * The server answers a wrong password and an unknown address identically, and
 * so does this screen: a friendlier "no account with that email" would leak
 * which addresses exist.
 */

/** Base64 blur of the hero, from scripts/build-brand-assets.mjs — inlined so
 *  the panel is never blank while the real photo streams in. */
const HERO_LQIP =
  "data:image/webp;base64,UklGRsgAAABXRUJQVlA4ILwAAACQBQCdASoYABoAPu1ur1KppiQiqAgBMB2JbACdMuI0bA8HXi0/tnhZ11rYQTYky935g1+qAADe3zJ0B12gmwGw8jxHsIBhrsfi6xg+06/eMX7G6K/Kynf6ogApu9khkP6Q63zHNRJzzt65WccLM5bB9Cq7EC9xlJaraydPgdDqSJef8mYfciDtGnriUOnw+9TS70TQlzvSRPj0vYPTBA44c3RhslNQ1mzHbznaE9+ZlNf6kTPLcfMaM1AAAA==";

/** One field: label + control, with the icon picking up the brand colour while
 *  the control inside has focus. */
function Field({
  label,
  htmlFor,
  children,
  delay,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  delay: string;
}) {
  return (
    <div
      // `focus-within:` (not `group-focus-within:`) — the focused control and
      // the icon share this element as their ancestor, so the group- variant
      // would be looking one level too far out and silently never match.
      className="auth-rise space-y-2 [&_svg]:transition-colors focus-within:[&_svg]:text-primary"
      style={{ animationDelay: delay }}
    >
      <Label htmlFor={htmlFor} className="text-[13.5px]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Shared sizing so both controls stay identical as the form scales. */
const FIELD = "h-12 text-[15px] rounded-lg";

export function LoginPage({ onSignedIn }: { onSignedIn: (user: StaffUser) => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const [heroLoaded, setHeroLoaded] = React.useState(false);
  /** Bumped on each failure so the shake replays even for an identical error. */
  const [shake, setShake] = React.useState(0);

  const emailRef = React.useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("busy");
    setError(null);
    try {
      const user = await login(email, password);
      // Hold the success state briefly — the console is a heavy first paint, and
      // a green tick reads better than a button that just stops responding.
      setStatus("done");
      setTimeout(() => onSignedIn(user), 520);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          (err?.request
            ? "Couldn't reach the server. Check that the API is running on port 5000."
            : "Something went wrong signing in.")
      );
      setStatus("idle");
      setShake((n) => n + 1);
    }
  };

  // Put the cursor back where the fix is, without wiping what they typed. This
  // has to wait for the render that re-enables the fieldset — focusing a still
  // disabled input silently does nothing.
  React.useEffect(() => {
    if (error && status === "idle") emailRef.current?.focus();
  }, [error, status]);

  const busy = status === "busy";
  const done = status === "done";
  const clearError = () => error && setError(null);

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]">
      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center">
          <div className="auth-rise">
            {/* Small screens only — the brand panel that carries the wordmark
                is hidden below lg, and a login with no mark on it reads as a
                phishing page. */}
            <BrandLogo tone="color" width={160} className="mb-8 h-[32px] lg:hidden" />

            <h1 className="font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground">
              Welcome back
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
              Sign in to run simulations, score rounds and edit game content.
            </p>
          </div>

          <form
            key={shake}
            onSubmit={submit}
            noValidate
            className={cn("mt-9", shake > 0 && "auth-shake")}
          >
            <fieldset disabled={busy || done} className="space-y-5">
              <Field label="Email" htmlFor="email" delay="60ms">
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoFocus
                  required
                  icon={<Mail />}
                  error={!!error}
                  aria-describedby={error ? "signin-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  placeholder="you@intlabs.io"
                  className={FIELD}
                />
              </Field>

              <Field label="Password" htmlFor="password" delay="120ms">
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  icon={<KeyRound />}
                  error={!!error}
                  aria-describedby={error ? "signin-error" : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  // Dots rather than words: the label already says "Password",
                  // and an empty box next to a filled-in email reads as broken.
                  placeholder="••••••••"
                  className={FIELD}
                />
              </Field>

              {/* Deliberately unanimated — an error the user cannot read is a
                  far worse outcome than one that simply appears. */}
              {error && (
                <p
                  id="signin-error"
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg bg-destructive-tint px-3.5 py-3 text-[13.5px] leading-5 text-destructive"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="auth-rise pt-1" style={{ animationDelay: "180ms" }}>
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!email || !password}
                  className={cn(
                    "group/cta h-12 w-full rounded-lg text-[15px]",
                    "transition-[background-color,transform,box-shadow] duration-200",
                    "hover:-translate-y-px hover:shadow-pop active:translate-y-0",
                    done && "!bg-success !text-white"
                  )}
                >
                  {done ? (
                    <>
                      <Check className="size-5" /> Signed in
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="size-5 transition-transform duration-200 group-hover/cta:translate-x-1" />
                    </>
                  )}
                </Button>
              </div>
            </fieldset>
          </form>

          <div
            className="auth-rise mt-9 space-y-2 border-t border-border pt-6"
            style={{ animationDelay: "240ms" }}
          >
            <p className="text-[13px] leading-5 text-muted-foreground">
              Teams sign in with a pass key in the player app, and a new console account is created
              with{" "}
              {/* No whitespace between the chip and the full stop, or JSX
                  renders "create-admin ." with a gap before the period. */}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                npm run create-admin
              </code>.
            </p>
          </div>
        </main>

        <footer className="shrink-0 text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} Int Labs · Stratagem
        </footer>
      </div>

      {/* ── Brand panel ──────────────────────────────────────────────── */}
      {/* Decorative: the photo says nothing the form doesn't, so it is hidden
          from assistive tech rather than described. */}
      <div
        aria-hidden
        className="relative hidden overflow-hidden lg:block lg:my-4 lg:mr-4 lg:rounded-[24px]"
      >
        <img
          src={HERO_LQIP}
          alt=""
          className={cn(
            "absolute inset-0 size-full scale-110 object-cover blur-xl transition-opacity duration-700",
            heroLoaded ? "opacity-0" : "opacity-100"
          )}
        />
        <picture>
          <source
            type="image/avif"
            srcSet="/brand/hero-640.avif 640w, /brand/hero-960.avif 960w, /brand/hero-1280.avif 1280w, /brand/hero-1800.avif 1800w"
            sizes="52vw"
          />
          <img
            src="/brand/hero-1280.webp"
            srcSet="/brand/hero-640.webp 640w, /brand/hero-960.webp 960w, /brand/hero-1280.webp 1280w, /brand/hero-1800.webp 1800w"
            sizes="52vw"
            alt=""
            // The only image above the fold — fetch it with the document.
            // Lowercase: React 18 forwards unknown props verbatim, and the DOM
            // attribute is `fetchpriority`. React 19 accepts the camelCase form.
            {...{ fetchpriority: "high" }}
            decoding="async"
            onLoad={() => setHeroLoaded(true)}
            className={cn(
              "auth-kenburns absolute inset-0 size-full object-cover transition-opacity duration-700",
              heroLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </picture>

        {/* Bottom-weighted navy scrim: keeps the faces clear while giving the
            headline enough contrast to clear AA. */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/94 via-navy-900/40 to-navy-900/20" />

        {/* Wordmark, top right, inside the image. */}
        <div className="absolute right-8 top-8 xl:right-10 xl:top-10">
          <BrandLogo tone="white" width={200} className="h-[38px] drop-shadow-sm" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <h2 className="auth-rise max-w-[15ch] font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.025em] text-white xl:text-[46px]">
            Teams decide. The market answers.
          </h2>
          <p
            className="auth-rise mt-5 max-w-[44ch] text-[15px] leading-6 text-white/80"
            style={{ animationDelay: "120ms" }}
          >
            Open a round, let every team commit, then score them against each other and publish
            the numbers the moment they land.
          </p>
        </div>
      </div>
    </div>
  );
}
