Firebase setup & deploy

1) Create a Firebase project in the console.
2) Add a Web App and copy the config object.
3) Replace the `firebaseConfig` in `frontend/app.js` with your web app values.

Functions (ML proxy)

- Set ML API URL for Functions config:

  firebase functions:config:set ml.api_url="https://your-ml-service.example"

- Deploy functions + hosting:

  firebase deploy --only functions,hosting

Local testing

- Run ML API locally (if using the local ML `ml/api.py`):

  cd ml
  python -m venv .venv
  .venv/Scripts/activate
  pip install -r requirements.txt
  uvicorn api:app --reload --port 8000

- Serve frontend locally:

  cd frontend
  npx http-server -c-1  # or `python -m http.server 8000`

Notes

- `firebase.json` already contains a rewrite for `/api/**` to the `api` function.
- For production, replace anonymous auth with proper sign-in flows and secure Firestore rules.
