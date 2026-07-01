// "Saldo disponível nas APIs" — extraído de CustosTab.tsx (Fase 9).
import { Section, SummaryCard } from "./primitives";
import type { AppSettings } from "./types";

export function BalancesSection({
  settings,
  allTimeCustoFalai,
  allTimeCustoOpenai,
  saldoFalai,
  saldoOpenai,
  brl,
}: {
  settings: AppSettings;
  allTimeCustoFalai: number;
  allTimeCustoOpenai: number;
  saldoFalai: number;
  saldoOpenai: number;
  brl: (usd: number) => string;
}) {
  return (
    <Section title="Saldo disponível nas APIs">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <SummaryCard
          label="fal.ai — saldo inicial"
          value={`$${settings.falai_balance_usd.toFixed(2)}`}
          sub={brl(settings.falai_balance_usd)}
          description="Valor total que você depositou na fal.ai. Defina em Ajustes de custo."
        />
        <SummaryCard
          label="fal.ai — consumido (clientes)"
          value={`-$${allTimeCustoFalai.toFixed(3)}`}
          sub={brl(allTimeCustoFalai)}
          warn
          description="Gasto dos clientes reais em imagens e vídeos. Admin e testes não entram neste cálculo."
        />
        <SummaryCard
          label="fal.ai — restante"
          value={`$${saldoFalai.toFixed(2)}`}
          sub={brl(saldoFalai)}
          highlight={saldoFalai < settings.falai_balance_usd * 0.3}
          description={
            saldoFalai < settings.falai_balance_usd * 0.3
              ? `Saldo informado menos consumo dos clientes reais. Abaixo de 30% — considere recarregar o fal.ai.`
              : `Saldo informado menos consumo dos clientes reais. Admin e testes não afetam este valor.`
          }
        />
        <SummaryCard
          label="OpenAI — saldo inicial"
          value={`$${settings.openai_balance_usd.toFixed(2)}`}
          sub={brl(settings.openai_balance_usd)}
          description="Valor disponível na sua conta OpenAI. Defina em Ajustes de custo."
        />
        <SummaryCard
          label="OpenAI — consumido (clientes)"
          value={`-$${allTimeCustoOpenai.toFixed(3)}`}
          sub={brl(allTimeCustoOpenai)}
          warn
          description="Gasto dos clientes reais em gerações de conteúdo. Admin e testes não entram neste cálculo."
        />
        <SummaryCard
          label="OpenAI — restante"
          value={`$${saldoOpenai.toFixed(2)}`}
          sub={brl(saldoOpenai)}
          highlight={saldoOpenai < settings.openai_balance_usd * 0.3}
          description={
            saldoOpenai < settings.openai_balance_usd * 0.3
              ? `Saldo informado menos consumo dos clientes reais. Abaixo de 30% — considere recarregar o OpenAI.`
              : `Saldo informado menos consumo dos clientes reais. Admin e testes não afetam este valor.`
          }
        />
      </div>
    </Section>
  );
}
