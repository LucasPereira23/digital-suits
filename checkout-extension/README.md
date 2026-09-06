# Business registration number — checkout UI extension

Implements task 2 of the test assignment: a checkout field for a business
registration number, shown only when the **Company** address field is
filled in, and validated on **Continue to shipping** / **Pay**.

## What it does

- Renders after the shipping address form (`purchase.checkout.delivery-address.render-after`).
- Hidden unless `shippingAddress.company` is non-empty.
- Input is auto-uppercased and restricted to `A-Z0-9`, max 12 characters, as the user types.
- Format required: `UA` + 8-10 digits (10-12 characters total) — enforced by `/^UA\d{8,10}$/`.
- Blocks checkout progress (`shopify.buyerJourney.intercept`, `block_progress` capability)
  when the field is required but missing/invalid, showing the error both inline on the
  field and as a checkout-level error.
- Persists the value as a **cart metafield** (`custom.business_registration_number`) via
  `applyMetafieldChange`, and rehydrates it if the buyer navigates back to this step.

Source: [extensions/business-reg-number/src/Checkout.jsx](extensions/business-reg-number/src/Checkout.jsx)

## One-time setup (no app exists yet in Partners)

This folder is an extension-only app skeleton (no backend). To link it to
your Partners org / dev store and run it:

```sh
cd checkout-extension
npm install
npm run config:link   # shopify app config link — creates/links the app in Partners
npm run dev            # shopify app dev — preview on your dev store's checkout
```

When ready to make it visible on the real checkout:

```sh
npm run deploy          # shopify app deploy
```

Then in the dev store admin: **Settings → Checkout → Customize** (or
**Settings → Apps and sales channels → Develop apps** flow, depending on
how the app was installed) → add the extension to the checkout, positioned
after the shipping address.

## Required: order metafield definition (to see the value on the Order)

`applyMetafieldChange` only writes a **cart** metafield. For Shopify to copy
it onto the resulting **order** (so it's visible in the admin order page),
create a matching order metafield definition once:

1. Admin → **Settings → Custom data → Orders → Add definition**
2. Namespace and key: `custom.business_registration_number`
3. Type: **Single line text**
4. Enable **"Copy value from cart to order"** (cart-to-order-copyable)

Without this definition, the value still validates and blocks checkout
correctly, but it will only exist on the cart, not on the finished order.

## Notes

- `company` requires only Level 1 protected-customer-data access (per
  Shopify's Addresses API), which development stores are exempt from
  approving explicitly. If this app is ever taken to production on a
  non-dev store, request Address (Level 1) access under **Partners →
  App → API access → Protected customer data**.
- `api_version = "2026-07"`, using the current web-components/Preact
  checkout UI extensions model (`@shopify/ui-extensions` on npm).
