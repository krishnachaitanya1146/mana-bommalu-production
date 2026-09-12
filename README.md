# MANA BOMMALU — Production-ready starter

This package keeps the existing MANA BOMMALU visual design but replaces demo/browser-only persistence with a real PostgreSQL-backed Node/Express service.

Customer: `/`
Admin: `/admin`
Health: `/health`

Main fixes:
1. Admin changes are persisted in PostgreSQL, not browser demo storage.
2. Customer and Admin read the same backend data.
3. Products, categories, coupons, customers, orders, order items, payments, variants and store settings have database tables.
4. Customer checkout records WhatsApp number and ordered item details.
5. Admin can update order status.
6. Optional WhatsApp Cloud API status notifications are server-side only.
7. Product `imageUrl` is persisted in the database.
8. Colour/variant records have `sort_order`, so the entered order can be preserved.

See `README-RENDER.md` and `GIT-RENDER-CHECKLIST.md` before deploying.
