-- Generic, handyman-first shared catalog.
-- Touches the shared catalog only (brands, products, skus). User tables are not changed:
-- saved prices keep their own names, and every existing sku id is kept, so
-- library_items.sku_id still resolves. Safe to run more than once.

insert into public.brands (id, name, slug, industry, website) values
  ('cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Unbranded', 'unbranded', 'home_improvement', null)
on conflict (id) do update set name = excluded.name, website = excluded.website;

insert into public.products (id, brand_id, name, category, description, industry) values
  ('89a58da1-73af-4c23-b6ad-72b807575900', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Service call', 'Labor & fees', 'Trip charge for showing up and diagnosing.', 'home_improvement'),
  ('a368ce52-c928-4773-9946-cf526e97848f', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Hourly labor', 'Labor & fees', 'Time on site, billed by the hour.', 'home_improvement'),
  ('b8d5a1e3-73a1-423a-a08f-ed4de4f9bd97', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Drywall patch', 'Handyman', 'Patch, tape, mud, and sand a small hole.', 'home_improvement'),
  ('02184880-8a0d-4b69-9a82-d99be9e00e2b', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Furniture assembly', 'Handyman', 'Assemble one flat-pack piece.', 'home_improvement'),
  ('523085b8-aaea-475c-9777-d2e2a3e13573', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'TV mount', 'Handyman', 'Mount a TV on drywall and hide the cables.', 'home_improvement'),
  ('c23b7a7b-6ddc-4119-b5a0-0be336acaa55', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Caulk tub or shower', 'Handyman', 'Remove old caulk and run a new bead.', 'home_improvement'),
  ('09d57177-da86-4fe2-9c36-8dca97dd35e5', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Door rehang', 'Carpentry', 'Rehang an interior door so it closes and latches.', 'home_improvement'),
  ('095e8f38-ea5c-4334-aadb-26e46d361cfa', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Weatherstrip a door', 'Carpentry', 'Replace worn weatherstrip and the door sweep.', 'home_improvement'),
  ('6a8b9b91-4bf5-4149-8dcb-d4fd2488bc07', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Faucet replace', 'Plumbing', 'Swap a kitchen or bath faucet the customer supplies.', 'home_improvement'),
  ('f893035c-4d35-4668-a8f7-35f5eae1196c', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Toilet repair', 'Plumbing', 'Replace the fill valve, flapper, or wax ring.', 'home_improvement'),
  ('f12be2e6-8a98-4675-a287-5558ca8086d0', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Garbage disposal replace', 'Plumbing', 'Remove the old unit and install a new one.', 'home_improvement'),
  ('e185ae25-f2c1-47d2-8d8f-281ad7db5caf', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Ceiling fan install', 'Electrical', 'Hang a fan on an existing rated box.', 'home_improvement'),
  ('eba27971-d705-4dcb-90e8-e86b8a8551da', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Outlet or switch swap', 'Electrical', 'Replace one outlet or switch on an existing circuit.', 'home_improvement'),
  ('47f7fe70-db74-424d-9325-a311fc4feab1', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Light fixture swap', 'Electrical', 'Replace one light fixture on an existing box.', 'home_improvement'),
  ('f72acc55-b151-48fc-ae4f-a840a25c6788', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Smoke detector install', 'Electrical', 'Install or replace one smoke detector.', 'home_improvement'),
  ('a2383ffd-f4fa-469c-b81a-57c14c7c9c4c', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Gutter clean', 'Exterior', 'Clear gutters and downspouts on a one-story home.', 'home_improvement'),
  ('852d9141-5a8f-5453-b3c2-b410fe235c2e', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Architectural shingles', 'Roofing & siding', 'Asphalt shingles for steep-slope roofs.', 'home_improvement'),
  ('ad0c4c46-6b69-55f6-9f81-44a6678b8e20', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Heavyweight architectural shingles', 'Roofing & siding', 'Thicker asphalt shingles.', 'home_improvement'),
  ('93228617-ae96-5157-8aa4-e09dcb84ae10', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Hip and ridge cap shingles', 'Roofing & siding', 'Cap shingles for hips and ridges.', 'home_improvement'),
  ('27b01d2a-1b60-5dfa-b977-e8030cf437f3', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Synthetic underlayment', 'Roofing & siding', 'Synthetic roof underlayment.', 'home_improvement'),
  ('bc9866ef-b797-5e2c-86e4-15148952444c', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Laminated shingles', 'Roofing & siding', 'Laminated asphalt shingles.', 'home_improvement'),
  ('03f960f8-908c-57b7-9f25-1d711d52ba8d', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Standard architectural shingles', 'Roofing & siding', 'Entry-level architectural shingles.', 'home_improvement'),
  ('ed5ed855-5314-51c4-bd66-4afbb6a43329', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Self-adhered leak barrier', 'Roofing & siding', 'Peel-and-stick barrier for eaves and valleys.', 'home_improvement'),
  ('db65fad1-82ad-5cdf-bf21-25283d2ab442', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Aluminum drip edge', 'Roofing & siding', 'Edge flashing for roof eaves and rakes.', 'home_improvement'),
  ('393fb731-271e-5da7-8dc1-992f9a459784', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Roofing nails', 'Roofing & siding', 'Coil nails for shingle fastening.', 'home_improvement'),
  ('f4f27a51-b2a4-5b41-8eb9-950f1d85e385', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Engineered wood lap siding', 'Roofing & siding', 'Engineered wood lap siding.', 'home_improvement'),
  ('b3144b07-fed8-54bd-be51-1d33e652320c', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'House wrap', 'Roofing & siding', 'Weather barrier for exterior walls.', 'home_improvement'),
  ('181cb373-89a1-566f-8c55-705c67f98fd7', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Vinyl corner post', 'Roofing & siding', 'Outside corner trim for vinyl siding.', 'home_improvement'),
  ('943e1a6f-b12f-532a-9a59-37f3855fde07', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Fiber-cement lap siding', 'Roofing & siding', 'Fiber-cement lap siding.', 'home_improvement'),
  ('03603b98-dc7d-5fc3-8ce5-4cded6d97722', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Fiber-cement trim boards', 'Roofing & siding', 'Fiber-cement trim boards.', 'home_improvement'),
  ('b108e016-0d8d-586e-9bee-dac5b807667d', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Fiber-cement soffit panels', 'Roofing & siding', 'Fiber-cement soffit panels.', 'home_improvement')
on conflict (id) do update set
  brand_id = excluded.brand_id,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.skus (
  id, product_id, sku_code, name, variation, unit, list_price_cents, connector_slug, attributes
) values
  ('710439d1-2958-4802-bfbf-2f53fa06666a', '89a58da1-73af-4c23-b6ad-72b807575900', 'HM-TRIP', 'Service call', 'Trip charge', 'each', 9500, 'handyman', '{}'::jsonb),
  ('6d37c36c-3f16-40d4-bb7a-0c1bcc523036', 'a368ce52-c928-4773-9946-cf526e97848f', 'HM-HOUR', 'Hourly labor', null, 'hour', 8500, 'handyman', '{}'::jsonb),
  ('2a3bd386-91dc-43fb-8e04-d9a2258ec813', 'b8d5a1e3-73a1-423a-a08f-ed4de4f9bd97', 'HM-DRYWALL', 'Drywall patch', 'Up to 6 in', 'each', 17500, 'handyman', '{"size":"Up to 6 in"}'::jsonb),
  ('81448051-ab9e-4a8d-aa58-51d068f57db1', '02184880-8a0d-4b69-9a82-d99be9e00e2b', 'HM-ASSEMBLE', 'Furniture assembly', 'One piece', 'each', 9000, 'handyman', '{}'::jsonb),
  ('068eb1cc-4bfe-45c4-9311-83bb9ed6277e', '523085b8-aaea-475c-9777-d2e2a3e13573', 'HM-TVMOUNT', 'TV mount', 'Up to 65 in', 'each', 15000, 'handyman', '{"size":"Up to 65 in"}'::jsonb),
  ('26eefa00-a39c-4099-baf7-36cae62a7ab9', 'c23b7a7b-6ddc-4119-b5a0-0be336acaa55', 'HM-CAULK', 'Caulk tub or shower', null, 'each', 12000, 'handyman', '{}'::jsonb),
  ('56c1a122-5424-423c-b025-0aac4fb6e437', '09d57177-da86-4fe2-9c36-8dca97dd35e5', 'HM-DOOR', 'Door rehang', 'Interior', 'each', 16500, 'handyman', '{}'::jsonb),
  ('e2fee4b2-340e-494a-856f-75917701f3ff', '095e8f38-ea5c-4334-aadb-26e46d361cfa', 'HM-WEATHER', 'Weatherstrip a door', null, 'each', 8500, 'handyman', '{}'::jsonb),
  ('6aafa256-00f1-48ab-9d79-8c817c0c6e4b', '6a8b9b91-4bf5-4149-8dcb-d4fd2488bc07', 'HM-FAUCET', 'Faucet replace', 'Customer supplies faucet', 'each', 18500, 'handyman', '{}'::jsonb),
  ('cde4fe2e-bdbc-4ed3-b63a-375206e100ba', 'f893035c-4d35-4668-a8f7-35f5eae1196c', 'HM-TOILET', 'Toilet repair', null, 'each', 14500, 'handyman', '{}'::jsonb),
  ('ff195a27-ecc0-4ba5-9a39-05df15656a47', 'f12be2e6-8a98-4675-a287-5558ca8086d0', 'HM-DISPOSAL', 'Garbage disposal replace', null, 'each', 22500, 'handyman', '{}'::jsonb),
  ('d71fd93a-a18c-459a-a8f7-ef9b91f73de4', 'e185ae25-f2c1-47d2-8d8f-281ad7db5caf', 'HM-FAN', 'Ceiling fan install', 'Existing box', 'each', 22000, 'handyman', '{}'::jsonb),
  ('108726e2-9235-4734-953c-65d71786f506', 'eba27971-d705-4dcb-90e8-e86b8a8551da', 'HM-OUTLET', 'Outlet or switch swap', null, 'each', 9500, 'handyman', '{}'::jsonb),
  ('19439b97-2518-47c8-8694-893fb0d2e1c5', '47f7fe70-db74-424d-9325-a311fc4feab1', 'HM-LIGHT', 'Light fixture swap', null, 'each', 13500, 'handyman', '{}'::jsonb),
  ('c9093379-42fd-437a-afca-09ffd1698dfe', 'f72acc55-b151-48fc-ae4f-a840a25c6788', 'HM-SMOKE', 'Smoke detector install', null, 'each', 7500, 'handyman', '{}'::jsonb),
  ('2ff138d8-d8bc-41d4-b958-781724c79b56', 'a2383ffd-f4fa-469c-b81a-57c14c7c9c4c', 'HM-GUTTER', 'Gutter clean', 'One story', 'each', 17500, 'handyman', '{}'::jsonb),
  ('719c4821-6e7a-5be1-bdf0-dfc4965af742', '852d9141-5a8f-5453-b3c2-b410fe235c2e', 'RS-ARCH-CHAR', 'Architectural shingles', 'Charcoal', 'square', 32000, 'home-depot', '{"color":"Charcoal"}'::jsonb),
  ('4b11f167-606f-5d24-9918-faf78ebe30ed', 'bc9866ef-b797-5e2c-86e4-15148952444c', 'RS-LAM-BLK', 'Laminated shingles', 'Black', 'square', 29500, 'home-depot', '{"color":"Black"}'::jsonb),
  ('573026b2-c096-537f-988f-3092b140540e', 'ed5ed855-5314-51c4-bd66-4afbb6a43329', 'RS-LEAK', 'Self-adhered leak barrier', null, 'roll', 11500, 'home-depot', '{}'::jsonb),
  ('fdb79d12-ac64-58cb-bc79-c16adc6913a5', 'db65fad1-82ad-5cdf-bf21-25283d2ab442', 'RS-DRIP-W', 'Aluminum drip edge', 'White', 'linear_ft', 250, 'home-depot', '{"color":"White"}'::jsonb),
  ('d0f27a9a-a5ff-5009-bcb5-f15661d3a57f', '393fb731-271e-5da7-8dc1-992f9a459784', 'RS-NAILS', 'Roofing nails, coil box', '1-1/4 in', 'each', 4200, 'home-depot', '{"size":"1-1/4 in"}'::jsonb),
  ('cbb5035d-d157-568e-b64d-66b9dbfdf423', '03f960f8-908c-57b7-9f25-1d711d52ba8d', 'RS-STD-BRN', 'Standard architectural shingles', 'Brown', 'square', 27500, 'lowes', '{"color":"Brown"}'::jsonb),
  ('23ccb4b1-fb93-51dd-b8af-83dd1d4cf599', 'f4f27a51-b2a4-5b41-8eb9-950f1d85e385', 'RS-WOODLAP', 'Engineered wood lap siding', null, 'sq_ft', 310, 'lowes', '{}'::jsonb),
  ('6f9ba51b-d289-5d40-9a79-b441ac8c42dc', 'b3144b07-fed8-54bd-be51-1d33e652320c', 'RS-WRAP', 'House wrap', null, 'roll', 16500, 'lowes', '{}'::jsonb),
  ('10508e7a-e6d2-52cb-913e-7c526fed0cac', '181cb373-89a1-566f-8c55-705c67f98fd7', 'RS-CORNER', 'Vinyl corner post', 'White', 'each', 1800, 'lowes', '{"color":"White"}'::jsonb),
  ('8151f24a-25a7-55d8-a293-c77bd1f34bcc', '852d9141-5a8f-5453-b3c2-b410fe235c2e', 'RS-ARCH', 'Architectural shingles', null, 'square', 34000, 'gaf', '{}'::jsonb),
  ('91e51b90-767b-5b67-a530-66a0f8d66184', 'ad0c4c46-6b69-55f6-9f81-44a6678b8e20', 'RS-ARCH-HD', 'Heavyweight architectural shingles', null, 'square', 41000, 'gaf', '{}'::jsonb),
  ('73a32f9a-2d87-5d6a-adab-63db6045bd8f', '93228617-ae96-5157-8aa4-e09dcb84ae10', 'RS-RIDGE', 'Hip and ridge cap shingles', null, 'bundle', 6800, 'gaf', '{}'::jsonb),
  ('183b11e0-81e4-5d12-bc39-a7f1be75024e', '27b01d2a-1b60-5dfa-b977-e8030cf437f3', 'RS-UNDER', 'Synthetic underlayment', null, 'roll', 9500, 'gaf', '{}'::jsonb),
  ('efe79e9f-3ab7-52bf-9a0e-b2934cf8a936', '943e1a6f-b12f-532a-9a59-37f3855fde07', 'RS-FCLAP', 'Fiber-cement lap siding', null, 'sq_ft', 425, 'james-hardie', '{}'::jsonb),
  ('d34f5ec1-f4a3-57fb-b107-f16f45dab6f9', '03603b98-dc7d-5fc3-8ce5-4cded6d97722', 'RS-FCTRIM', 'Fiber-cement trim boards', null, 'linear_ft', 380, 'james-hardie', '{}'::jsonb),
  ('3d64de28-0e02-5669-99b8-79569799b2a8', 'b108e016-0d8d-586e-9bee-dac5b807667d', 'RS-FCSOFFIT', 'Fiber-cement soffit panels', null, 'sq_ft', 350, 'james-hardie', '{}'::jsonb)
on conflict (id) do update set
  sku_code = excluded.sku_code,
  name = excluded.name,
  variation = excluded.variation,
  attributes = excluded.attributes;

-- Maker rows from the first catalog, removed only once no product points at them.
delete from public.brands b
where b.slug in ('gaf', 'owens-corning', 'james-hardie', 'lp', 'gcp', 'dupont')
  and not exists (select 1 from public.products p where p.brand_id = b.id);
