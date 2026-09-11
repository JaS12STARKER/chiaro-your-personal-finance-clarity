-- 1. user_id automatico
CREATE OR REPLACE FUNCTION private.set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := private.current_profile_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','accounts','categories','budgets','income','savings_goals','recurring_expenses','notifications','ai_insights','financial_snapshots']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_user_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_user_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_user_id()', t);
  END LOOP;
END $$;

-- 2. registro unico entrate -> movimenti
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS income_id uuid REFERENCES public.income(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_income_id_key
  ON public.transactions(income_id) WHERE income_id IS NOT NULL;

UPDATE public.income i
SET account_id = (SELECT a.id FROM public.accounts a WHERE a.user_id = i.user_id ORDER BY a.created_at LIMIT 1)
WHERE i.account_id IS NULL;

DELETE FROM public.income WHERE account_id IS NULL;

ALTER TABLE public.income ALTER COLUMN account_id SET NOT NULL;

CREATE OR REPLACE FUNCTION private.income_sync_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE income_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions
      (user_id, account_id, amount, date, description, source, status, income_id, is_recurring)
    VALUES
      (NEW.user_id, NEW.account_id, abs(NEW.amount), NEW.date, NEW.description,
       'manual', 'booked', NEW.id, NEW.is_recurring);
    RETURN NEW;
  END IF;

  UPDATE public.transactions
     SET account_id = NEW.account_id,
         amount = abs(NEW.amount),
         date = NEW.date,
         description = NEW.description,
         is_recurring = NEW.is_recurring,
         user_id = NEW.user_id
   WHERE income_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.transactions
      (user_id, account_id, amount, date, description, source, status, income_id, is_recurring)
    VALUES
      (NEW.user_id, NEW.account_id, abs(NEW.amount), NEW.date, NEW.description,
       'manual', 'booked', NEW.id, NEW.is_recurring);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS income_sync ON public.income;
CREATE TRIGGER income_sync
AFTER INSERT OR UPDATE OR DELETE ON public.income
FOR EACH ROW EXECUTE FUNCTION private.income_sync_transaction();