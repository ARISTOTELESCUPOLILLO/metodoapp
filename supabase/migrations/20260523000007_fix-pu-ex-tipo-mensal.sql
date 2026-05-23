-- PU e EX01 passam a ser mensais (expiram junto com o ciclo do mês)
UPDATE public.plans SET tipo = 'mensal' WHERE codigo IN ('EX01','PU2','PU4','PU8');
