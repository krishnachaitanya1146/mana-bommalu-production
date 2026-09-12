# MANA BOMMALU - Render production setup

This version fixes the disappearing-data problem by moving the shared store data from browser/demo storage into PostgreSQL.

## What is fixed
- Admin changes are stored in PostgreSQL and survive Render redeploys/restarts.
- Customer store reads the same database, so product/category/coupon/store changes are shared.
- Products support a persistent `imageUrl` field. Use an externally hosted image URL for now; do not store uploaded files on Render's ephemeral filesystem.
- Orders save customer name, phone, WhatsApp number, address, products, quantities, total, payment method/status and order status.
- Admin can update order status.
- Optional WhatsApp Cloud API notification is triggered when an admin changes order status, if the Meta credentials and approved template are configured.
- Colour/variant table exists in PostgreSQL and keeps `sort_order`; the existing UI does not reorder colours.

## Local run
1. Install Node.js 20+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env` and fill DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD.
4. Run `npm install`.
5. Run `npm start`.
6. Open http://localhost:8080/ for Customer and http://localhost:8080/admin for Admin.

## Render - exact steps
1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint from the repository, or create a Web Service + Postgres manually.
3. If using the included `render.yaml`, Render creates the web service and Postgres database. Set the secret env vars when prompted.
4. If doing it manually, create a Render Postgres database in the same region as the web service. Copy its INTERNAL DATABASE URL into the web service environment variable `DATABASE_URL`.
5. Set:
   ADMIN_EMAIL = your real admin email
   ADMIN_PASSWORD = a strong unique password
6. Build command: `npm install`
7. Start command: `npm start`
8. Deploy.
9. Open `/admin` and log in with the credentials above.
10. Add/edit a product, refresh the customer page, then redeploy. The product must still exist because it is in Postgres.

## Important about existing Render data
The old browser/demo data is not automatically recoverable from this package. Before switching production, export any important data from the old system. Do not delete the old service until you have verified the new database.

## WhatsApp status notifications
The code uses WhatsApp Cloud API template messages. You must create/configure an approved Meta WhatsApp message template named by `WHATSAPP_STATUS_TEMPLATE` with two body variables: order ID and status. Put the Meta access token and phone-number ID into Render Environment Variables. Customers should have opted in to receive WhatsApp notifications.

The website itself can still use a normal `wa.me` click-to-chat button for customer-initiated conversations; API notifications are a separate feature.

## Images
The database stores image URLs. For production, host images in Cloudinary, Cloudflare R2, S3, or another persistent object store and paste the URL into Admin > Products > Image URL. Do not rely on `uploads/` on the Render web-service filesystem.

## Security
- Do not commit `.env`.
- Do not put the Meta token in HTML/JavaScript.
- Change the demo admin credentials before going live.
- The admin API requires the server-side admin session.
