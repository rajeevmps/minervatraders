CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, updated_at)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    now()
  )
  ON CONFLICT (id) DO UPDATE SET 
      updated_at = now(),
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger ensuring that whenever a user signs up or updates auth info, public.users natively updates
DROP TRIGGER IF EXISTS on_auth_user_synced ON auth.users;
CREATE TRIGGER on_auth_user_synced
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_auth_user_to_public();
