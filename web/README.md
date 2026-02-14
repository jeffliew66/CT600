This simple static app provides a one-page data-entry and computed-output view for validating the HMRC v2 mapping and tax calculations.

How to deploy to Vercel:

1. Initialize a Git repo at the project root (where the `web` folder sits).
   git init
   git add .
   git commit -m "Add HMRC v2 web validator"

2. Push to a remote (GitHub/GitLab/Bitbucket).

3. Go to https://vercel.com, import the repository and deploy. Vercel will serve the `web` folder as static assets automatically.

Notes:
- The calculator is intentionally simple and mirrors mapping rules in the codebase.
- Thresholds are not time-apportioned in this quick app; for multi-FY APs use the tax engine.
- Computed fields are marked with [C].
