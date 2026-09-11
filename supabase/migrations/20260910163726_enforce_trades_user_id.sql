ALTER TABLE public.trades
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.trades
    ADD CONSTRAINT trades_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;