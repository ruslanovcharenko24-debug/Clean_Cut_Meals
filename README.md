# Clean Cut Meals — QR prototype (student concept)

**Student concept for MTU Brand Challenge — not an official Clean Cut Meals service.**

A mobile web page a shopper opens by scanning a QR code at the shelf: one meal per page (Butter Chicken, Beef Stroganoff, Spaghetti Bolognese), another meal for tonight or tomorrow, a link to share, and links that open the meal on retailer sites. The prototype takes no orders or payments and uses no accounts, cookies, analytics or tracking.

- Product information: copied from each meal's SuperValu product page, data as of 13 Oct 2026 (`data/products.json`). Always check the pack, especially for allergies.
- Order links: `data/order-links.json`; only checked links are shown.
- Pack photos: official SuperValu product images (unchanged). Retailer logos: official files from SuperValu, Uber Eats and the Just Eat app listing (sources in `data/order-links.json`). Used for a student showcase; no partnership is implied. The Clean Cut Meals logo is not included.
- Just Eat is shown as a labelled demo: no store or meal availability is claimed.
- Typeface: Lexend, SIL Open Font License (`public/fonts/OFL-Lexend.txt`).

## Creator
Original idea, concept and creative direction by Ruslan Ovcharenko — ruslanovcharenko24@gmail.com, +353 83 080 4967. Authorship and third-party material: see `NOTICE.md`.

## Run locally
```
npm ci
npm start        # build + preview at http://localhost:4321
```
Publishing: `.github/workflows/deploy.yml` builds with Astro and deploys to GitHub Pages on push to `main`.
