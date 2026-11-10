-- 0017_rls_policies.sql
-- Row Level Security for every table added in 0010–0016, plus the updated
-- policies for the renamed catalogue and voucher tables.
--
-- The rules:
--   * a customer sees only their own rows
--   * a vendor sees only the rows of a vendor they belong to
--   * a partner sees only the rows of a partner they belong to
--   * an admin sees everything
--   * enterprise code plaintext is never readable by a partner user

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_write_admin on public.user_roles;
create policy user_roles_write_admin on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.user_role_grants enable row level security;

drop policy if exists user_role_grants_select on public.user_role_grants;
create policy user_role_grants_select on public.user_role_grants
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_role_grants_write_admin on public.user_role_grants;
create policy user_role_grants_write_admin on public.user_role_grants
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- vendor members and applications
-- ---------------------------------------------------------------------------
alter table public.vendor_members enable row level security;

drop policy if exists vendor_members_select on public.vendor_members;
create policy vendor_members_select on public.vendor_members
  for select using (
    user_id = auth.uid()
    or public.can_manage_vendor(vendor_id)
    or public.is_admin()
  );

drop policy if exists vendor_members_write on public.vendor_members;
create policy vendor_members_write on public.vendor_members
  for all using (public.can_manage_vendor(vendor_id) or public.is_admin())
  with check (public.can_manage_vendor(vendor_id) or public.is_admin());

alter table public.vendor_applications enable row level security;

drop policy if exists vendor_applications_select on public.vendor_applications;
create policy vendor_applications_select on public.vendor_applications
  for select using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active
    )
    or public.is_admin()
  );

drop policy if exists vendor_applications_write on public.vendor_applications;
create policy vendor_applications_write on public.vendor_applications
  for all using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  ) with check (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- enterprise partners
-- ---------------------------------------------------------------------------
alter table public.enterprise_partners enable row level security;

drop policy if exists enterprise_partners_select on public.enterprise_partners;
create policy enterprise_partners_select on public.enterprise_partners
  for select using (
    public.is_enterprise_member(id) or public.is_admin()
  );

drop policy if exists enterprise_partners_write on public.enterprise_partners;
create policy enterprise_partners_write on public.enterprise_partners
  for all using (public.can_manage_partner(id) or public.is_admin())
  with check (public.can_manage_partner(id) or public.is_admin());

alter table public.enterprise_members enable row level security;

drop policy if exists enterprise_members_select on public.enterprise_members;
create policy enterprise_members_select on public.enterprise_members
  for select using (
    user_id = auth.uid() or public.can_manage_partner(partner_id) or public.is_admin()
  );

drop policy if exists enterprise_members_write on public.enterprise_members;
create policy enterprise_members_write on public.enterprise_members
  for all using (public.can_manage_partner(partner_id) or public.is_admin())
  with check (public.can_manage_partner(partner_id) or public.is_admin());

alter table public.enterprise_products enable row level security;

drop policy if exists enterprise_products_select on public.enterprise_products;
create policy enterprise_products_select on public.enterprise_products
  for select using (
    public.is_enterprise_member(partner_id) or public.is_admin()
  );

drop policy if exists enterprise_products_write on public.enterprise_products;
create policy enterprise_products_write on public.enterprise_products
  for all using (public.can_manage_partner(partner_id) or public.is_admin())
  with check (public.can_manage_partner(partner_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- categories, media
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (active or public.is_admin());

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_media enable row level security;

drop policy if exists product_media_select on public.product_media;
create policy product_media_select on public.product_media
  for select using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active
    )
    or public.is_admin()
  );

drop policy if exists product_media_write on public.product_media;
create policy product_media_write on public.product_media
  for all using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  ) with check (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin on public.notifications
  for insert with check (public.is_admin());

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- system settings and audit log
-- ---------------------------------------------------------------------------
alter table public.system_settings enable row level security;

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select using (is_public or public.is_admin());

drop policy if exists system_settings_write_admin on public.system_settings;
create policy system_settings_write_admin on public.system_settings
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select using (public.is_admin());

-- Inserts happen inside the security-definer write_audit() function.

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------
drop policy if exists gift_cards_select on public.vouchers;
create policy vouchers_select on public.vouchers
  for select using (
    buyer_id = auth.uid()
    or claimed_by = auth.uid()
    or public.is_admin()
    or (vendor_id is not null and public.can_redeem_for(vendor_id))
  );

-- Vouchers are issued only by the fulfilment functions (service role or
-- security definer). No client insert/update policy.

drop policy if exists vouchers_update_vendor on public.vouchers;
create policy vouchers_update_vendor on public.vouchers
  for update using (public.can_manage_vendor(vendor_id) or public.is_admin())
  with check (public.can_manage_vendor(vendor_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- orders and order items
-- ---------------------------------------------------------------------------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id
        and oi.vendor_id is not null
        and public.can_redeem_for(oi.vendor_id)
    )
  );

drop policy if exists orders_insert_buyer on public.orders;
create policy orders_insert_buyer on public.orders
  for insert with check (buyer_id = auth.uid());

alter table public.order_items enable row level security;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
    or public.is_admin()
    or (vendor_id is not null and public.can_redeem_for(vendor_id))
  );

drop policy if exists order_items_insert_buyer on public.order_items;
create policy order_items_insert_buyer on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- ledger entries
-- ---------------------------------------------------------------------------
drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select on public.ledger_entries
  for select using (
    exists (
      select 1 from public.vouchers v
      where v.id = ledger_entries.voucher_id
        and (
          v.buyer_id = auth.uid()
          or v.claimed_by = auth.uid()
          or public.is_admin()
          or (v.vendor_id is not null and public.can_redeem_for(v.vendor_id))
        )
    )
  );

-- No insert/update/delete policies: writes happen only inside security-definer
-- functions. The append-only trigger also blocks update/delete.

-- ---------------------------------------------------------------------------
-- redemptions
-- ---------------------------------------------------------------------------
alter table public.redemptions enable row level security;

drop policy if exists redemptions_select on public.redemptions;
create policy redemptions_select on public.redemptions
  for select using (
    public.is_admin()
    or (vendor_id is not null and public.can_redeem_for(vendor_id))
    or exists (
      select 1 from public.vouchers v
      where v.id = redemptions.voucher_id
        and (v.buyer_id = auth.uid() or v.claimed_by = auth.uid())
    )
  );

drop policy if exists redemptions_insert_admin on public.redemptions;
create policy redemptions_insert_admin on public.redemptions
  for insert with check (public.is_admin());

alter table public.redemption_items enable row level security;

drop policy if exists redemption_items_select on public.redemption_items;
create policy redemption_items_select on public.redemption_items
  for select using (
    exists (select 1 from public.redemptions r where r.id = redemption_items.redemption_id)
  );

-- ---------------------------------------------------------------------------
-- enterprise inventory
--
-- The `code_ciphertext` column is readable only by the service role. Partner
-- staff see metadata and the masked last four digits.
-- ---------------------------------------------------------------------------
alter table public.enterprise_import_batches enable row level security;

drop policy if exists enterprise_import_batches_select on public.enterprise_import_batches;
create policy enterprise_import_batches_select on public.enterprise_import_batches
  for select using (
    public.is_enterprise_member(partner_id) or public.is_admin()
  );

drop policy if exists enterprise_import_batches_write on public.enterprise_import_batches;
create policy enterprise_import_batches_write on public.enterprise_import_batches
  for all using (public.can_manage_partner(partner_id) or public.is_admin())
  with check (public.can_manage_partner(partner_id) or public.is_admin());

alter table public.enterprise_code_inventory enable row level security;

drop policy if exists enterprise_code_inventory_select on public.enterprise_code_inventory;
create policy enterprise_code_inventory_select on public.enterprise_code_inventory
  for select using (
    public.is_enterprise_member(partner_id) or public.is_admin()
  );

drop policy if exists enterprise_code_inventory_write on public.enterprise_code_inventory;
create policy enterprise_code_inventory_write on public.enterprise_code_inventory
  for all using (public.can_manage_partner(partner_id) or public.is_admin())
  with check (public.can_manage_partner(partner_id) or public.is_admin());

alter table public.enterprise_code_events enable row level security;

drop policy if exists enterprise_code_events_select on public.enterprise_code_events;
create policy enterprise_code_events_select on public.enterprise_code_events
  for select using (
    public.is_enterprise_member(partner_id) or public.is_admin()
  );

drop policy if exists enterprise_code_events_insert_admin on public.enterprise_code_events;
create policy enterprise_code_events_insert_admin on public.enterprise_code_events
  for insert with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- customer owned tables
-- ---------------------------------------------------------------------------
alter table public.recipients enable row level security;

drop policy if exists recipients_own on public.recipients;
create policy recipients_own on public.recipients
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_own on public.payment_methods;
create policy payment_methods_own on public.payment_methods
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

alter table public.favourites enable row level security;

drop policy if exists favourites_own on public.favourites;
create policy favourites_own on public.favourites
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

alter table public.vendor_locations enable row level security;

drop policy if exists vendor_locations_select on public.vendor_locations;
create policy vendor_locations_select on public.vendor_locations
  for select using (
    exists (select 1 from public.vendors v where v.id = vendor_locations.vendor_id and v.status = 'approved')
    or public.can_manage_vendor(vendor_id)
    or public.is_admin()
  );

drop policy if exists vendor_locations_write on public.vendor_locations;
create policy vendor_locations_write on public.vendor_locations
  for all using (public.can_manage_vendor(vendor_id) or public.is_admin())
  with check (public.can_manage_vendor(vendor_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- campaigns and placements
-- ---------------------------------------------------------------------------
alter table public.campaigns enable row level security;

drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns
  for select using (status = 'live' or public.is_admin());

drop policy if exists campaigns_write_admin on public.campaigns;
create policy campaigns_write_admin on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.campaign_placements enable row level security;

drop policy if exists campaign_placements_select on public.campaign_placements;
create policy campaign_placements_select on public.campaign_placements
  for select using (
    public.campaign_is_live(campaign_id) or public.is_admin()
  );

drop policy if exists campaign_placements_write_admin on public.campaign_placements;
create policy campaign_placements_write_admin on public.campaign_placements
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.banners enable row level security;

drop policy if exists banners_select on public.banners;
create policy banners_select on public.banners
  for select using (active or public.is_admin());

drop policy if exists banners_write_admin on public.banners;
create policy banners_write_admin on public.banners
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- finance structures: admin only for now
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;
drop policy if exists payment_transactions_admin on public.payment_transactions;
create policy payment_transactions_admin on public.payment_transactions
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.refunds enable row level security;
drop policy if exists refunds_admin on public.refunds;
create policy refunds_admin on public.refunds
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.vendor_commissions enable row level security;
drop policy if exists vendor_commissions_select on public.vendor_commissions;
create policy vendor_commissions_select on public.vendor_commissions
  for select using (public.can_manage_vendor(vendor_id) or public.is_admin());

alter table public.platform_fees enable row level security;
drop policy if exists platform_fees_admin on public.platform_fees;
create policy platform_fees_admin on public.platform_fees
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.partner_settlements enable row level security;
drop policy if exists partner_settlements_select on public.partner_settlements;
create policy partner_settlements_select on public.partner_settlements
  for select using (public.is_enterprise_member(partner_id) or public.is_admin());

alter table public.financial_ledger enable row level security;
drop policy if exists financial_ledger_admin on public.financial_ledger;
create policy financial_ledger_admin on public.financial_ledger
  for select using (public.is_admin());

alter table public.webhook_events enable row level security;
drop policy if exists webhook_events_admin on public.webhook_events;
create policy webhook_events_admin on public.webhook_events
  for select using (public.is_admin());
