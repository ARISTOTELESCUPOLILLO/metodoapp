import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/esqueci-senha')({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg">
        <h1 className="text-xl font-bold text-foreground mb-2">Redefinir senha</h1>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Se este email estiver cadastrado, você receberá um link para criar uma nova senha.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe seu email para receber o link.</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
              placeholder="seu@email.com"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}
        <div className="mt-4 text-sm text-center">
          <Link to="/login" className="underline text-muted-foreground">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
