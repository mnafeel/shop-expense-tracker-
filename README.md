# Shop Expense Tracker

Track shop purchases and labour expenses. Data saves to Firebase Firestore when you connect with a sync code.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/

## Deploy on GitHub Pages

1. Create a new repository on GitHub (e.g. `shop-expense-tracker`).
2. Push this project to the `main` branch:

```bash
git init
git add .
git commit -m "Initial commit: shop expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. In the repo on GitHub: **Settings → Pages → Build and deployment**
   - **Source** must be **GitHub Actions** (not “Deploy from branch”)
   - If you see a blank page, this setting is usually wrong
4. After the workflow runs, your site will be at:

`https://YOUR_USERNAME.github.io/YOUR_REPO/`

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repository name.
