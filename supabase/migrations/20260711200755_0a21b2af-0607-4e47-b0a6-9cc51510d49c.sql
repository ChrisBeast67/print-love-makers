CREATE TABLE public.premium_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_eur numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_orders TO authenticated;
GRANT ALL ON public.premium_orders TO service_role;

ALTER TABLE public.premium_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or staff can view all orders"
ON public.premium_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_premium_order()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _prem boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_premium INTO _prem FROM public.user_exp WHERE user_id = _me;
  IF COALESCE(_prem, false) THEN RAISE EXCEPTION 'Already premium'; END IF;

  IF EXISTS (SELECT 1 FROM public.premium_orders WHERE user_id = _me AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending order';
  END IF;

  INSERT INTO public.premium_orders (user_id) VALUES (_me) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_premium_order_paid(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT user_id INTO _target FROM public.premium_orders
    WHERE id = _order_id AND status = 'pending';
  IF _target IS NULL THEN RAISE EXCEPTION 'Order not found or already paid'; END IF;

  UPDATE public.premium_orders
    SET status = 'paid', paid_at = now(), paid_by = auth.uid()
    WHERE id = _order_id;

  INSERT INTO public.user_exp (user_id, is_premium, updated_at)
    VALUES (_target, true, now())
    ON CONFLICT (user_id) DO UPDATE SET is_premium = true, updated_at = now();

  UPDATE public.profiles SET is_premium = true, updated_at = now() WHERE id = _target;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_premium_orders()
RETURNS TABLE(id uuid, user_id uuid, username text, amount_eur numeric, status text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT o.id, o.user_id, p.username, o.amount_eur, o.status, o.created_at
  FROM public.premium_orders o
  JOIN public.profiles p ON p.id = o.user_id
  ORDER BY (o.status = 'pending') DESC, o.created_at DESC;
END;
$$;