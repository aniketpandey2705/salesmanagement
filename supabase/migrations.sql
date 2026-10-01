
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

ALTER TABLE sales ADD COLUMN shift_id UUID REFERENCES seller_shifts(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN shift_id UUID REFERENCES seller_shifts(id) ON DELETE SET NULL;

