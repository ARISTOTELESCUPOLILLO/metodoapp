import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

type Segmento = 'SERVIÇOS' | 'VAREJO' | 'MARCA';

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [segmento, setSegmento] = useState<Segmento | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: '/' });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!segmento) { setError('Escolha o segmento do seu negócio.'); return; }
    if (password.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { segmento },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('não foi convidado') || msg.toLowerCase().includes('database error')) {
        setError('Este e-mail não foi convidado. Solicite acesso ao administrador.');
      } else if (msg.toLowerCase().includes('already')) {
        setError('Este e-mail já tem cadastro. Faça login.');
      } else {
        setError(msg);
      }
      return;
    }
    // Persistir segmento no profile (handle_new_user já criou a linha)
    if (data.user) {
      await supabase.from('profiles').update({ segmento } as any).eq('id', data.user.id);
    }
    if (data.session) {
      navigate({ to: '/' });
    } else {
      setSuccess('Cadastro criado! Verifique seu e-mail para confirmar a conta.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground mb-1">Criar conta</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Use o e-mail que recebeu o convite do administrador.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Confirmar senha</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Segmento do seu negócio</label>
            <div className="grid grid-cols-3 gap-2">
              {(['SERVIÇOS','VAREJO','MARCA'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSegmento(s)}
                  className={`px-2 py-2 rounded-md border text-xs font-semibold ${segmento === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Define como o app personaliza imagens (avatar, produto ou cenário). Pode ser ajustado depois.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}
          <button type="submit" disabled={loading}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50">
            {loading ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
        <div className="mt-6 text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="underline">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
