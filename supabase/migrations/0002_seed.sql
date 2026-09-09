-- 0002_seed.sql — production seed (templates + couriers + demo product)
-- The order_events INSERT for landing submissions must be done server-side with the
-- service_role key (RLS: authenticated only).

insert into couriers (name, contact, fee_per_delivery_mad, fee_per_return_mad) values
  ('أمانة', '0522000000', 35, 18),
  ('Ozone', '0522900000', 25, 12),
  ('CTM', '0522800000', 30, 15);

insert into message_templates (key, body_ar) values
('confirm_1', E'سلام {name} 👋\nوصلنا طلبك ديال {product} مقاس {size} ✅\n💰 {total} درهم — الدفع عند الاستلام\n📍 {city}\n📏 المقاس عندك التبديل ديالو مجاني إلا ماجاكش\n\nجاوب بـ *1* للتأكيد ولا *2* للإلغاء 🙏'),
('followup_2', E'سلام {name} 🙏 مازال مقفلين معانا فتأكيد {product}...\nالكمية محدودة — جاوب *1* للتأكيد / *2* للإلغاء'),
('followup_3', E'آخر رسالة 🙏 إلا ما تأكدش الطلب ديال {product} هاد اليوم غنلغيو من النظام.\n*1* تأكيد / *2* إلغاء'),
('day_before', E'سلام {name} ✅ الطلب ديال {product} غيخرج غدا للتوصيل 🚚\nجاوب *1* باش نأكدو، ورجاك يكون متوفر على الرقم 🙏'),
('shipped', E'طلبك فالطريق 🚚 رقم التتبع: {tracking}'),
('thanks', E'شكرا على الثقة 🙏 إلا عجبك المقاس والتصميم شاركهم مع صحابك 😉'),
('returned_sorry', E'سلام {name} 🙏 وصلك الطلب ماشي مقاسك؟ ماشي مشكل — التبديل مجاني. جاوبنا فواتساب ونرتبو ليك التبديل.');

insert into products (name, image_urls, price_mad, old_price_mad, cost_mad, sizes, colors) values
('حذاء رياضي Urban Step',
 '["https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/16e2e26e2d2f.jpg","https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0ebaa6145dcb.jpeg","https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/60716d5bb2e0.jpg","https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6fdca56479ce.jpg","https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b7f0de266de9.png","https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8fa13a4e54cc.jpg"]'::jsonb,
 249, 399, 140,
 '["39","40","41","42","43","44","45"]'::jsonb,
 '[{"name":"أبيض","hex":"#f5f5f4"},{"name":"أسود","hex":"#1c1917"},{"name":"بيج","hex":"#d6c8b5"}]'::jsonb);
