CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin',
        'farm_manager',
        'worker',
        'customer',
        'guest'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE user_status AS ENUM (
        'active',
        'pending',
        'suspended',
        'disabled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE farm_status AS ENUM (
        'active',
        'inactive',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE membership_status AS ENUM (
        'invited',
        'active',
        'inactive'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE farm_member_role AS ENUM (
        'owner',
        'manager',
        'worker',
        'veterinarian',
        'accountant',
        'dispatcher'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE crop_status AS ENUM (
        'planned',
        'seeded',
        'growing',
        'harvesting',
        'harvested',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE livestock_status AS ENUM (
        'healthy',
        'watch',
        'treatment',
        'sold',
        'deceased'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE product_status AS ENUM (
        'draft',
        'active',
        'out_of_stock',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending',
        'confirmed',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'authorized',
        'paid',
        'failed',
        'refunded',
        'partially_refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE task_status AS ENUM (
        'todo',
        'in_progress',
        'blocked',
        'done',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE attendance_status AS ENUM (
        'present',
        'absent',
        'late',
        'half_day'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE advisory_type AS ENUM (
        'weather',
        'disease',
        'irrigation',
        'feed',
        'market',
        'operations',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE verification_purpose AS ENUM (
        'email_verification',
        'phone_verification',
        'password_reset',
        'login_otp'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE session_type AS ENUM (
        'morning',
        'afternoon',
        'evening'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE payment_status_type AS ENUM (
        'pending',
        'approved',
        'paid'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    password_hash text NOT NULL,
    role user_role NOT NULL DEFAULT 'guest',
    status user_status NOT NULL DEFAULT 'pending',
    avatar_url text,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT app_users_email_unique UNIQUE (email),
    CONSTRAINT app_users_phone_unique UNIQUE (phone)
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    date_of_birth date,
    gender text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    country text,
    postal_code text,
    bio text,
    preferred_language text DEFAULT 'en',
    timezone text DEFAULT 'UTC',
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    farm_code text NOT NULL,
    name text NOT NULL,
    description text,
    location_name text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    country text,
    postal_code text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    total_area_acres numeric(12,2),
    status farm_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT farms_code_unique UNIQUE (farm_code),
    CONSTRAINT farms_name_unique_per_owner UNIQUE (owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS farm_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    member_role farm_member_role NOT NULL,
    status membership_status NOT NULL DEFAULT 'invited',
    invited_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    joined_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT farm_memberships_unique UNIQUE (farm_id, user_id)
);

CREATE TABLE IF NOT EXISTS farm_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    block_code text NOT NULL,
    name text NOT NULL,
    area_acres numeric(12,2),
    soil_type text,
    irrigation_type text,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT farm_blocks_unique UNIQUE (farm_id, block_code)
);

CREATE TABLE IF NOT EXISTS crop_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    block_id uuid REFERENCES farm_blocks(id) ON DELETE SET NULL,
    crop_name text NOT NULL,
    variety text,
    season text,
    planting_date date,
    expected_harvest_date date,
    actual_harvest_date date,
    current_stage text,
    status crop_status NOT NULL DEFAULT 'planned',
    expected_yield numeric(12,2),
    yield_unit text DEFAULT 'kg',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crop_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id uuid NOT NULL REFERENCES crop_cycles(id) ON DELETE CASCADE,
    observed_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    observed_at timestamptz NOT NULL DEFAULT now(),
    growth_stage text,
    plant_health_score numeric(5,2),
    moisture_score numeric(5,2),
    pest_risk_score numeric(5,2),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disease_detections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    crop_cycle_id uuid REFERENCES crop_cycles(id) ON DELETE SET NULL,
    block_id uuid REFERENCES farm_blocks(id) ON DELETE SET NULL,
    detected_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    image_url text,
    disease_name text NOT NULL,
    severity text NOT NULL,
    confidence numeric(5,2) NOT NULL,
    ai_model_version text,
    recommendations text,
    status text NOT NULL DEFAULT 'open',
    detected_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS livestock_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    group_code text NOT NULL,
    species text NOT NULL,
    breed text,
    purpose text,
    count_current integer NOT NULL DEFAULT 0,
    status livestock_status NOT NULL DEFAULT 'healthy',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT livestock_groups_unique UNIQUE (farm_id, group_code)
);

CREATE TABLE IF NOT EXISTS livestock_animals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    group_id uuid REFERENCES livestock_groups(id) ON DELETE SET NULL,
    tag_code text NOT NULL,
    species text NOT NULL,
    breed text,
    sex text,
    birth_date date,
    acquisition_date date,
    current_weight_kg numeric(10,2),
    health_status livestock_status NOT NULL DEFAULT 'healthy',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT livestock_animals_tag_unique UNIQUE (tag_code)
);

CREATE TABLE IF NOT EXISTS livestock_health_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id uuid NOT NULL REFERENCES livestock_animals(id) ON DELETE CASCADE,
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    reported_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    event_date date NOT NULL DEFAULT current_date,
    diagnosis text,
    treatment text,
    medication text,
    cost_amount numeric(12,2),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    item_code text NOT NULL,
    item_name text NOT NULL,
    item_category text NOT NULL,
    unit text NOT NULL DEFAULT 'unit',
    quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0,
    reorder_level numeric(14,3),
    cost_per_unit numeric(12,2),
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inventory_items_unique UNIQUE (farm_id, item_code)
);

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    product_code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    unit text NOT NULL DEFAULT 'kg',
    sku text,
    price numeric(12,2) NOT NULL,
    available_quantity numeric(14,3) NOT NULL DEFAULT 0,
    rating numeric(3,2) NOT NULL DEFAULT 0,
    badge text,
    qr_code text,
    status product_status NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT products_unique UNIQUE (farm_id, product_code),
    CONSTRAINT products_sku_unique UNIQUE (sku),
    CONSTRAINT products_qr_unique UNIQUE (qr_code)
);

CREATE TABLE IF NOT EXISTS product_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_code text NOT NULL,
    harvested_at timestamptz,
    packed_at timestamptz,
    expiry_date date,
    quantity numeric(14,3) NOT NULL DEFAULT 0,
    qr_payload text,
    verification_status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT product_batches_unique UNIQUE (product_id, batch_code)
);

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL,
    customer_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    farm_id uuid REFERENCES farms(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    subtotal numeric(12,2) NOT NULL DEFAULT 0,
    tax_amount numeric(12,2) NOT NULL DEFAULT 0,
    delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
    discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    delivery_name text,
    delivery_phone text,
    delivery_address_line1 text,
    delivery_address_line2 text,
    delivery_city text,
    delivery_state text,
    delivery_country text,
    delivery_postal_code text,
    placed_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    packed_at timestamptz,
    shipped_at timestamptz,
    delivered_at timestamptz,
    cancelled_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_number_unique UNIQUE (order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id uuid REFERENCES product_batches(id) ON DELETE SET NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider text NOT NULL,
    payment_reference text NOT NULL,
    payment_method text,
    sender_name text,
    sender_bank_name text,
    sender_account_number text,
    sender_phone text,
    sender_note text,
    status payment_status NOT NULL DEFAULT 'pending',
    amount numeric(12,2) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'USD',
    paid_at timestamptz,
    raw_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payments_reference_unique UNIQUE (payment_reference)
);

CREATE TABLE IF NOT EXISTS deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    courier_name text,
    tracking_number text,
    status text NOT NULL DEFAULT 'pending',
    dispatch_at timestamptz,
    delivered_at timestamptz,
    proof_of_delivery_url text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deliveries_tracking_unique UNIQUE (tracking_number)
);

CREATE TABLE IF NOT EXISTS tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    assigned_to_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    created_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    crop_cycle_id uuid REFERENCES crop_cycles(id) ON DELETE SET NULL,
    livestock_group_id uuid REFERENCES livestock_groups(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    category text,
    session session_type,
    priority text NOT NULL DEFAULT 'medium',
    status task_status NOT NULL DEFAULT 'todo',
    progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    due_date date,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    attendance_date date NOT NULL,
    check_in_at timestamptz,
    check_out_at timestamptz,
    status attendance_status NOT NULL DEFAULT 'present',
    location_note text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_unique UNIQUE (farm_id, user_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    farm_id uuid REFERENCES farms(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    priority text NOT NULL DEFAULT 'normal',
    channel text NOT NULL DEFAULT 'in_app',
    read_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_attendances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    worker_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    date date NOT NULL,
    session session_type NOT NULL,
    attendance_status text NOT NULL DEFAULT 'Present',
    task_status text NOT NULL DEFAULT 'In Progress',
    status payment_status_type NOT NULL DEFAULT 'pending',
    payment_amount numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task_attendances_unique UNIQUE (farm_id, worker_id, task_id)
);

CREATE TABLE IF NOT EXISTS ai_advisories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid REFERENCES farms(id) ON DELETE CASCADE,
    created_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    advisory_kind advisory_type NOT NULL,
    title text NOT NULL,
    summary text,
    details text NOT NULL,
    source text,
    confidence numeric(5,2),
    effective_from timestamptz,
    effective_to timestamptz,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    observed_at timestamptz NOT NULL DEFAULT now(),
    temperature_c numeric(5,2),
    humidity_pct numeric(5,2),
    rainfall_mm numeric(8,2),
    wind_speed_kph numeric(8,2),
    condition text,
    raw_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid REFERENCES farms(id) ON DELETE CASCADE,
    generated_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    report_type text NOT NULL,
    title text NOT NULL,
    summary text,
    file_url text,
    parameters jsonb,
    generated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_reviews_unique UNIQUE (product_id, customer_user_id)
);

CREATE TABLE IF NOT EXISTS auth_verification_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
    purpose verification_purpose NOT NULL,
    target_value text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    device_name text,
    ip_address inet,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT auth_refresh_tokens_unique UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    scope text NOT NULL DEFAULT 'global',
    description text,
    updated_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT system_settings_unique UNIQUE (setting_key, scope)
);

CREATE TABLE IF NOT EXISTS monthly_salary_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid REFERENCES farms(id) ON DELETE CASCADE,
    worker_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
    manager_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    payment_month text NOT NULL,
    total_completed_tasks integer NOT NULL DEFAULT 0,
    total_approved_sessions integer NOT NULL DEFAULT 0,
    basic_salary numeric(12,2) NOT NULL DEFAULT 0,
    bonus numeric(12,2) NOT NULL DEFAULT 0,
    deductions numeric(12,2) NOT NULL DEFAULT 0,
    final_payment_amount numeric(12,2) NOT NULL DEFAULT 0,
    bank_account_name text,
    bank_name text,
    branch_name text,
    account_number_masked text,
    payment_method text,
    transaction_reference text,
    payment_date timestamptz DEFAULT now(),
    payment_status text NOT NULL DEFAULT 'Paid',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'app_users',
        'user_profiles',
        'farms',
        'farm_memberships',
        'farm_blocks',
        'crop_cycles',
        'disease_detections',
        'livestock_groups',
        'livestock_animals',
        'livestock_health_events',
        'inventory_items',
        'products',
        'product_batches',
        'orders',
        'order_items',
        'payments',
        'deliveries',
        'tasks',
        'task_attendances',
        'attendance_records',
        'notifications',
        'ai_advisories',
        'reports',
        'marketplace_reviews',
        'auth_verification_codes',
        'auth_refresh_tokens',
        'system_settings',
        'monthly_salary_payments',
        'contact_messages'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_farms_owner_user_id ON farms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_farm_memberships_user_id ON farm_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_blocks_farm_id ON farm_blocks(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_cycles_farm_id ON crop_cycles(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_cycles_block_id ON crop_cycles(block_id);
CREATE INDEX IF NOT EXISTS idx_disease_detections_farm_id ON disease_detections(farm_id);
CREATE INDEX IF NOT EXISTS idx_livestock_groups_farm_id ON livestock_groups(farm_id);
CREATE INDEX IF NOT EXISTS idx_livestock_animals_group_id ON livestock_animals(group_id);
CREATE INDEX IF NOT EXISTS idx_products_farm_id ON products(farm_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_farm_id ON tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_task_attendances_worker_id ON task_attendances(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_attendances_farm_id ON task_attendances(farm_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_advisories_farm_id ON ai_advisories(farm_id);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_farm_id ON weather_snapshots(farm_id);
CREATE INDEX IF NOT EXISTS idx_reports_farm_id ON reports(farm_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_product_id ON marketplace_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_user_id ON auth_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
C R E A T E   T A B L E   I F   N O T   E X I S T S   c h a t _ s e s s i o n s   ( 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
         u s e r _ i d   u u i d   N O T   N U L L   R E F E R E N C E S   a p p _ u s e r s ( i d )   O N   D E L E T E   C A S C A D E , 
         t i t l e   t e x t   N O T   N U L L , 
         c r e a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) , 
         u p d a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 ) ; 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   c h a t _ m e s s a g e s   ( 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
         c h a t _ i d   u u i d   N O T   N U L L   R E F E R E N C E S   c h a t _ s e s s i o n s ( i d )   O N   D E L E T E   C A S C A D E , 
         s e n d e r   t e x t   N O T   N U L L , 
         m e s s a g e   t e x t   N O T   N U L L , 
         t i m e s t a m p   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 ) ;  
 
