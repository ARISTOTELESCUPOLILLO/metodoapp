import { Link } from "@tanstack/react-router";
import { Home, Moon, Sun, History, Users, LogOut, UserX, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useImpersonation, stopImpersonation } from "@/hooks/useImpersonation";
import { useDarkMode } from "@/hooks/useDarkMode";
import logoOp from "@/assets/lp-logo-op.png";

export function TopBar() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const impersonation = useImpersonation();
  const [isDark, toggleDark] = useDarkMode();
  const [confirmLogout, setConfirmLogout] = useState(false);
  if (!user) return null;

  const iconBtn: React.CSSProperties = {
    background: "var(--brand-primary)",
    border: "none",
    color: "#fff",
    width: 32,
    height: 32,
    minWidth: 44,
    minHeight: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,.15)",
  };

  return (
    <>
      {impersonation && (
        <div
          style={{
            background: "#fde68a",
            color: "#78350f",
            padding: "8px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            fontWeight: 600,
            borderBottom: "2px solid #f59e0b",
          }}
        >
          <span>
            {impersonation.isTest && (
              <span
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  marginRight: 8,
                }}
              >
                TESTE
              </span>
            )}
            👤 Atuando como <strong>{impersonation.nome}</strong> ({impersonation.email}) —
            alterações no Kit de Marca serão salvas para esse usuário.
          </span>
          <button
            type="button"
            onClick={() => {
              stopImpersonation();
              window.location.assign("/app");
            }}
            style={{
              background: "#78350f",
              color: "#fff",
              border: "none",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UserX size={14} /> Sair desse modo
          </button>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px",
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/app"
          title="Início"
          aria-label="Início"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <img
            src={logoOp}
            alt="Método OP"
            style={{ height: 28, width: "auto", display: "block" }}
          />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Link to="/app" style={iconBtn} title="Início" aria-label="Voltar para a home">
            <Home size={16} />
          </Link>
          <button
            type="button"
            style={iconBtn}
            title={isDark ? "Modo claro" : "Modo escuro"}
            aria-label="Alternar tema"
            onClick={toggleDark}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/conta" style={iconBtn} title="Minha conta" aria-label="Minha conta">
            <History size={16} />
          </Link>
          <Link
            to="/historico"
            style={iconBtn}
            title="Histórico de gerações"
            aria-label="Histórico de gerações"
          >
            <ImageIcon size={16} />
          </Link>
          {isAdmin && (
            <Link to="/admin" style={iconBtn} title="Administração" aria-label="Administração">
              <Users size={16} />
            </Link>
          )}
          <button
            type="button"
            style={iconBtn}
            title="Sair"
            aria-label="Sair"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {confirmLogout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
          }}
          onClick={() => setConfirmLogout(false)}
        >
          <div
            style={{
              background: "#0f1a33",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "24px 28px",
              maxWidth: 320,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Sair da conta?
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Você precisará fazer login novamente para acessar o app.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => signOut().then(() => window.location.assign("/login"))}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "#c0392b",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
