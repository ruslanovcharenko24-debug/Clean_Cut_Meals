# Clean Cut Meals — QR prototype (student concept)

**Student concept for MTU Brand Challenge — not an official Clean Cut Meals service.**

A mobile web page a shopper opens by scanning a QR code at the shelf: one meal per page (Butter Chicken, Beef Stroganoff, Spaghetti Bolognese), another meal for tonight or tomorrow, a link to share, and links that open the meal on retailer sites. The prototype takes no orders or payments and uses no accounts, cookies, analytics or tracking.

- Product information: copied from each meal's SuperValu product page, data as of 13 Oct 2026 (`data/products.json`). Always check the pack, especially for allergies.
- Order links: `data/order-links.json`; only checked links are shown.
- Pack photos and the logo are **not** in this repository: permission to publish them is not confirmed. The public site shows text instead.
- Typeface: Lexend, SIL Open Font License (`public/fonts/OFL-Lexend.txt`).

## Run locally
```
npm ci
npm start        # build + preview at http://localhost:4321
```
Publishing: `.github/workflows/deploy.yml` builds with Astro and deploys to GitHub Pages on push to `main`.
