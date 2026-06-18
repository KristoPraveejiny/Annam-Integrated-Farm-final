-- 1. Add new enum values (Cannot be run inside a transaction block in older Postgres)
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';

-- 2. Update products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS farmer_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS harvest_date date,
ADD COLUMN IF NOT EXISTS quality_grade text;

-- Change default status to 'pending' instead of 'draft'
ALTER TABLE products ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Create product_approvals table
CREATE TABLE IF NOT EXISTS product_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    manager_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('approved', 'rejected')),
    approved_price numeric(12,2),
    remarks text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create carts table
CREATE TABLE IF NOT EXISTS carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT carts_customer_unique UNIQUE (customer_id)
);

-- 5. Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity numeric(14,3) NOT NULL,
    price numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cart_items_unique UNIQUE (cart_id, product_id)
);

-- 6. Add triggers for new tables
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'carts',
        'cart_items'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END $$;
