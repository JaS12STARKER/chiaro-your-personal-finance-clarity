
-- ENUMS
CREATE TYPE public.theme_pref AS ENUM ('light','dark','system');
CREATE TYPE public.account_type AS ENUM ('checking','savings','credit_card','debit_card','cash','investment','other');
CREATE TYPE public.sync_status AS ENUM ('active','consent_expired','disconnected','manual');
CREATE TYPE public.essential_level AS ENUM ('necessario','importante','discrezionale','altro');
CREATE TYPE public.payment_method AS ENUM ('card','bank_transfer','cash','direct_debit','other');
CREATE TYPE public.tx_source AS ENUM ('manual','open_banking','csv_import');
CREATE TYPE public.tx_status AS ENUM ('pending','booked');
CREATE TYPE public.budget_period AS ENUM ('weekly','monthly');
CREATE TYPE public.income_source_type AS ENUM ('salary','bonus','overtime','freelance','rental','reimbursement','other');
CREATE TYPE public.recurrence_frequency AS ENUM ('weekly','monthly','yearly');
CREATE TYPE public.notification_type AS ENUM ('budget_exceeded','budget_warning','recurring_due','anomaly','goal_progress','sync_failed','consent_expiring');
CREATE TYPE public.insight_type AS ENUM ('saving_opportunity','anomaly','recommendation','health_score_explanation');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  email text,
  full_name text,
  locale text NOT NULL DEFAULT 'it-IT',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
$$;

-- SETTINGS
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency_default text NOT NULL DEFAULT 'EUR',
  locale text NOT NULL DEFAULT 'it-IT',
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme public.theme_pref NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.account_type NOT NULL DEFAULT 'checking',
  currency text NOT NULL DEFAULT 'EUR',
  initial_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  iban_masked text,
  sync_status public.sync_status NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  essential_level public.essential_level NOT NULL DEFAULT 'importante',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- RECURRING EXPENSES
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  frequency public.recurrence_frequency NOT NULL DEFAULT 'monthly',
  next_due_date date,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_expenses FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  date date NOT NULL,
  description text,
  payment_method public.payment_method NOT NULL DEFAULT 'card',
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_expense_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  external_transaction_id text,
  source public.tx_source NOT NULL DEFAULT 'manual',
  status public.tx_status NOT NULL DEFAULT 'booked',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX transactions_external_unique
  ON public.transactions(account_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
CREATE INDEX transactions_user_date_idx ON public.transactions(user_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- BUDGETS
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  period public.budget_period NOT NULL DEFAULT 'monthly',
  warning_threshold integer NOT NULL DEFAULT 80,
  start_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- INCOME
CREATE TABLE public.income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  source_type public.income_source_type NOT NULL DEFAULT 'salary',
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  description text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income TO authenticated;
GRANT ALL ON public.income TO service_role;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own income" ON public.income FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- SAVINGS GOALS
CREATE TABLE public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric(12,2) NOT NULL,
  current_amount numeric(12,2) NOT NULL DEFAULT 0,
  target_date date,
  monthly_contribution numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_goals TO service_role;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.savings_goals FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- FINANCIAL SNAPSHOTS
CREATE TABLE public.financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  total_income numeric(12,2) NOT NULL DEFAULT 0,
  total_expenses numeric(12,2) NOT NULL DEFAULT 0,
  net_savings numeric(12,2) NOT NULL DEFAULT 0,
  savings_rate numeric(5,2) NOT NULL DEFAULT 0,
  financial_health_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_snapshots TO authenticated;
GRANT ALL ON public.financial_snapshots TO service_role;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.financial_snapshots FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- AI INSIGHTS
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.insight_type NOT NULL,
  content text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  is_dismissed boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights" ON public.ai_insights FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- BALANCE RECALCULATION
CREATE OR REPLACE FUNCTION public.recalc_account_balance(p_account_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.accounts a
  SET current_balance = a.initial_balance + COALESCE((
    SELECT SUM(t.amount) FROM public.transactions t
    WHERE t.account_id = a.id AND t.status = 'booked'
  ), 0)
  WHERE a.id = p_account_id;
$$;

CREATE OR REPLACE FUNCTION public.transactions_balance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM public.recalc_account_balance(OLD.account_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM public.recalc_account_balance(NEW.account_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER transactions_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_balance_trigger();

CREATE OR REPLACE FUNCTION public.accounts_balance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
    PERFORM public.recalc_account_balance(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER accounts_balance
AFTER UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.accounts_balance_trigger();

-- BOOTSTRAP
CREATE OR REPLACE FUNCTION public.bootstrap_profile()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_email text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id INTO v_profile FROM public.profiles WHERE auth_user_id = v_uid;
  IF v_profile IS NOT NULL THEN RETURN v_profile; END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
    INTO v_email, v_name FROM auth.users u WHERE u.id = v_uid;

  INSERT INTO public.profiles (auth_user_id, email, full_name)
  VALUES (v_uid, v_email, v_name) RETURNING id INTO v_profile;

  INSERT INTO public.settings (user_id) VALUES (v_profile);

  INSERT INTO public.categories (user_id, name, essential_level, is_default, sort_order)
  SELECT v_profile, c.name, c.lvl::public.essential_level, true, c.ord
  FROM (VALUES
    ('Casa','necessario',1),('Affitto','necessario',2),('Bollette','necessario',3),
    ('Assicurazioni','necessario',4),('Salute','necessario',5),
    ('Alimentari','importante',6),('Trasporti','importante',7),('Auto','importante',8),
    ('Abbonamenti','importante',9),
    ('Ristoranti','discrezionale',10),('Shopping','discrezionale',11),
    ('Intrattenimento','discrezionale',12),('Viaggi','discrezionale',13),
    ('Investimenti','altro',14),('Risparmio','altro',15),('Altro','altro',16)
  ) AS c(name, lvl, ord);

  RETURN v_profile;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile() TO authenticated;

-- ACCOUNT DELETION (data only)
CREATE OR REPLACE FUNCTION public.delete_my_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.profiles WHERE auth_user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;
