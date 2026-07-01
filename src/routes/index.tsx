import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Camera, BarChart3, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pasimo — Smart Attendance & Workforce Management" },
      {
        name: "description",
        content:
          "Track employee attendance with GPS + selfie verification. Real-time analytics, geo-fencing, and reports for modern teams.",
      },
      { property: "og:title", content: "Pasimo — Smart Attendance & Workforce Management" },
      {
        property: "og:description",
        content:
          "GPS + selfie attendance tracking with admin analytics, geo-fencing, and reports.",
      },
    ],
  }),
  component: Landing,
});

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Pasimo</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> GPS + selfie verified attendance
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Smart attendance for modern teams
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Pasimo helps you track when and where your team clocks in — with selfie
          proof, geo-fencing, and real-time analytics.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/auth">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/auth">Employee sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={Camera}
            title="Selfie verification"
            body="Every check-in captures a selfie so you always know who clocked in."
          />
          <Feature
            icon={MapPin}
            title="GPS & geo-fence"
            body="Restrict check-ins to your office location with a customizable radius."
          />
          <Feature
            icon={Clock}
            title="One-tap check-in"
            body="Employees clock in and out with a single tap from any device."
          />
          <Feature
            icon={BarChart3}
            title="Admin analytics"
            body="See who's in, who's late, and monthly summaries at a glance."
          />
          <Feature
            icon={Users}
            title="Employee management"
            body="Add, edit and organize your team by department in seconds."
          />
          <Feature
            icon={ShieldCheck}
            title="Role-based access"
            body="Admins manage the workforce. Employees see just what they need."
          />
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Pasimo
      </footer>
    </div>
  );
}
