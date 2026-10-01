-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: products
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
  selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sellers
CREATE TABLE sellers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  seller_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  block TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stock_transfers (from admin to seller)
CREATE TABLE stock_transfers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_price_at_transfer NUMERIC(10, 2) NOT NULL,
  selling_price_at_transfer NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sales
CREATE TABLE sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_price NUMERIC(10, 2) NOT NULL,
  selling_price NUMERIC(10, 2) NOT NULL,
  revenue NUMERIC(10, 2) NOT NULL,
  total_cost NUMERIC(10, 2) NOT NULL,
  profit NUMERIC(10, 2) NOT NULL,
  seller_profit NUMERIC(10, 2) NOT NULL,
  owner_profit NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Admin role function helper
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by owner" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admin can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Products Policies
CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin can manage products" ON products
  FOR ALL USING (is_admin());

-- Sellers Policies
CREATE POLICY "Admin can manage sellers" ON sellers
  FOR ALL USING (is_admin());

CREATE POLICY "Seller can view own seller profile" ON sellers
  FOR SELECT USING (user_id = auth.uid());

-- Stock Transfers Policies
CREATE POLICY "Admin can manage stock transfers" ON stock_transfers
  FOR ALL USING (is_admin());

CREATE POLICY "Seller can view own stock transfers" ON stock_transfers
  FOR SELECT USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

-- Sales Policies
CREATE POLICY "Admin can view all sales" ON sales
  FOR SELECT USING (is_admin());

CREATE POLICY "Seller can view own sales" ON sales
  FOR SELECT USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

CREATE POLICY "Seller can insert own sales" ON sales
  FOR INSERT WITH CHECK (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

-- Views for calculating inventory
CREATE OR REPLACE VIEW seller_inventory AS
SELECT 
  s.id AS seller_id,
  p.id AS product_id,
  p.name AS product_name,
  COALESCE(transfers.total_received, 0) - COALESCE(sales.total_sold, 0) AS available_quantity
FROM sellers s
CROSS JOIN products p
LEFT JOIN (
  SELECT seller_id, product_id, SUM(quantity) as total_received
  FROM stock_transfers
  GROUP BY seller_id, product_id
) transfers ON transfers.seller_id = s.id AND transfers.product_id = p.id
LEFT JOIN (
  SELECT seller_id, product_id, SUM(quantity) as total_sold
  FROM sales
  GROUP BY seller_id, product_id
) sales ON sales.seller_id = s.id AND sales.product_id = p.id;

-- Shift Management
CREATE TABLE seller_shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE seller_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own shifts" ON seller_shifts FOR ALL USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admin view all shifts" ON seller_shifts FOR SELECT USING (is_admin());

ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES seller_shifts(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES seller_shifts(id) ON DELETE SET NULL;


-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  amount_due NUMERIC(10, 2) NOT NULL,
  payment_status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  shift_id UUID REFERENCES seller_shifts(id) ON DELETE SET NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage orders" ON orders FOR ALL USING (is_admin());
CREATE POLICY "Admin can update orders" ON orders FOR UPDATE USING (is_admin());
CREATE POLICY "Seller can view own orders" ON orders FOR SELECT USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));
CREATE POLICY "Seller can insert own orders" ON orders FOR INSERT WITH CHECK (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));
CREATE POLICY "Seller can update own orders" ON orders FOR UPDATE USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

-- Table: seller_notes
CREATE TABLE IF NOT EXISTS seller_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE seller_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage notes" ON seller_notes FOR ALL USING (is_admin());
CREATE POLICY "Seller can view own notes" ON seller_notes FOR SELECT USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));
CREATE POLICY "Seller can update own notes" ON seller_notes FOR UPDATE USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

