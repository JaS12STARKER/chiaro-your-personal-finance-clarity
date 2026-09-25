CREATE OR REPLACE FUNCTION private.accounts_init_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.current_balance := COALESCE(NEW.initial_balance, 0);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.accounts_init_balance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER accounts_init_balance_trigger BEFORE INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION private.accounts_init_balance();
SELECT private.recalc_account_balance(id) FROM public.accounts;