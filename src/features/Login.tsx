import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { Logo } from "@/components/Layout";
import { DEMO_USERS, useAuth } from "@/hooks/useAuth";
import { isDemo } from "@/lib/firebase/config";

export function Login() {
  const { signInEmail, signInGoogle, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => fn().catch((e: Error) => setErr(e.message));

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <Logo />
          <div>
            <div className="font-semibold">City P&amp;L Control Center</div>
            <div className="text-xs text-muted">Sign in to continue</div>
          </div>
        </div>

        {isDemo ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">Demo mode – pick a role to see what each person sees:</p>
            {DEMO_USERS.map((u) => (
              <Button key={u.uid} variant="outline" className="w-full justify-between" onClick={() => signInDemo(u.uid)}>
                {u.name}
                <span className="text-xs text-muted">{Object.values(u.roles)[0]}</span>
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => signInEmail(email, pw));
            }}
          >
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            <Button type="submit" className="w-full">Sign in</Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => run(signInGoogle)}>Continue with Google</Button>
          </form>
        )}
        {err && <p className="mt-3 text-xs text-bad">{err}</p>}
      </Card>
    </div>
  );
}
