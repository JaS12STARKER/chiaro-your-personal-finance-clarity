
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_profile_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.recalc_account_balance(p_account_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.accounts a
  SET current_balance = a.initial_balance + COALESCE((
    SELECT SUM(t.amount) FROM public.transactions t
    WHERE t.account_id = a.id AND t.status = 'booked'
  ), 0)
  WHERE a.id = p_account_id;
$$;
REVOKE ALL ON FUNCTION private.recalc_account_balance(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.transactions_balance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM private.recalc_account_balance(OLD.account_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM private.recalc_account_balance(NEW.account_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.transactions_balance_trigger() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.accounts_balance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
    PERFORM private.recalc_account_balance(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.accounts_balance_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER transactions_balance ON public.transactions;
CREATE TRIGGER transactions_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION private.transactions_balance_trigger();

DROP TRIGGER accounts_balance ON public.accounts;
CREATE TRIGGER accounts_balance
AFTER UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION private.accounts_balance_trigger();

-- repoint policies
DROP POLICY "own settings" ON public.settings;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own accounts" ON public.accounts;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own categories" ON public.categories;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own recurring" ON public.recurring_expenses;
CREATE POLICY "own recurring" ON public.recurring_expenses FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own transactions" ON public.transactions;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own budgets" ON public.budgets;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own income" ON public.income;
CREATE POLICY "own income" ON public.income FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own goals" ON public.savings_goals;
CREATE POLICY "own goals" ON public.savings_goals FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own snapshots" ON public.financial_snapshots;
CREATE POLICY "own snapshots" ON public.financial_snapshots FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own notifications" ON public.notifications;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());
DROP POLICY "own insights" ON public.ai_insights;
CREATE POLICY "own insights" ON public.ai_insights FOR ALL TO authenticated
  USING (user_id = private.current_profile_id()) WITH CHECK (user_id = private.current_profile_id());

DROP FUNCTION public.current_profile_id();
DROP FUNCTION public.recalc_account_balance(uuid);
DROP FUNCTION public.transactions_balance_trigger();
DROP FUNCTION public.accounts_balance_trigger();

REVOKE ALL ON FUNCTION public.bootstrap_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;
