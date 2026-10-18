-- One-time testnet HBAR grant so judges and testers can try purchases and retirements with a fresh wallet.
alter table public.profiles add column test_hbar_granted_at timestamptz;

-- Users cannot set it themselves (same rule as the wallet fields).
create or replace function public.guard_profile_wallet()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.wallet_address = old.wallet_address;
    new.hedera_account_id = old.hedera_account_id;
    new.email = old.email;
    new.test_hbar_granted_at = old.test_hbar_granted_at;
  end if;
  return new;
end;
$$;
