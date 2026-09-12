# MANA BOMMALU — GitHub + Render checklist

## A. GitHub

1. Create a new private GitHub repository, e.g. `mana-bommalu-production`.
2. Put every file from this folder into the repository root.
3. Do NOT upload `.env`.
4. Commit and push.

Commands:

```bash
git init
git add .
git commit -m "MANA BOMMALU production database and WhatsApp setup"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## B. Render

### Easiest route
Use the included `render.yaml` as a Blueprint.

Render will create:
- one Node web service
- one PostgreSQL database
- DATABASE_URL wiring between them

### Manual route
If you do not use the Blueprint:

1. Create a PostgreSQL database.
2. Create a Node Web Service from the GitHub repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add `DATABASE_URL` using the Render Postgres INTERNAL connection string.
6. Add `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
7. Deploy.

Render Postgres gives an internal connection URL for Render-hosted services. Use the internal URL when the web service and database are in the same region.

## C. Render values you must provide

Required:
- DATABASE_URL
- ADMIN_EMAIL
- ADMIN_PASSWORD

Optional for WhatsApp notifications:
- WHATSAPP_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_API_VERSION
- WHATSAPP_STATUS_TEMPLATE
- WHATSAPP_TEMPLATE_LANGUAGE

## D. First test after deployment

1. Open `https://YOUR-RENDER-DOMAIN/`.
2. Open `https://YOUR-RENDER-DOMAIN/admin`.
3. Log in with ADMIN_EMAIL and ADMIN_PASSWORD.
4. Add a test product.
5. Change its price.
6. Open the customer page in another tab.
7. Confirm the same product and price appear.
8. Create a test order with a real/test WhatsApp number only if you intend to test notifications.
9. Change the order to Shipped in Admin.
10. Confirm the order status changes and, after Meta configuration, the WhatsApp notification is sent.
11. Trigger a new Render deploy.
12. Confirm the test product, category, coupon and order still exist.

## E. Custom domain

Only after the deployment works, connect your purchased domain in Render > Settings > Custom Domains.
