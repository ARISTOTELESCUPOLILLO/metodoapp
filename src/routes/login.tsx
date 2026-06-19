import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/app" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message === "Invalid login credentials") {
        setError("Email ou senha inválidos.");
      } else if (error.message === "Email not confirmed") {
        setError("E-mail ainda não confirmado. Clique em Reenviar para receber um novo link.");
        setShowResend(true);
      } else {
        setError(error.message);
      }
      return;
    }
    navigate({ to: "/app" });
  }

  async function resendConfirmation() {
    await supabase.auth.resend({ type: "signup", email });
    setError("E-mail de confirmação reenviado. Verifique sua caixa de entrada.");
    setShowResend(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground mb-1">Método OP</h1>
        <p className="text-sm text-muted-foreground mb-6">Entre com seu email e senha.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Senha</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {showResend && (
            <button
              type="button"
              onClick={resendConfirmation}
              className="w-full px-4 py-2 rounded-md border border-input bg-background text-foreground text-sm font-medium"
            >
              Reenviar e-mail de confirmação
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div className="mt-6 text-sm text-center text-muted-foreground space-y-2">
          <div>
            <Link to="/esqueci-senha" className="underline">
              Esqueci minha senha
            </Link>
          </div>
          <div>
            Tem um convite?{" "}
            <Link to="/signup" className="underline">
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
