# Deployment Guide: Flask ML Microservice

Since you have already deployed your Node.js backend and React frontend, this guide explains how to deploy the new Python Flask API that hosts your `theme_model.pkl` and connect it to your existing infrastructure.

## 1. Prepare the Flask Project
We have created a `flask_api` folder containing:
- `app.py`: The Flask server
- `requirements.txt`: The python dependencies (`flask`, `scikit-learn`, `joblib`, `gunicorn`)

> [!TIP]
> Ensure that `theme_model.pkl` is pushed to your Git repository so the deployment server can access it. In `app.py`, the model path is configured to look in the root folder (relative to `flask_api`).

## 2. Deploying on Render (Recommended)

Render is great for Python microservices and has a free tier.

1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Fill in the deployment details:
   - **Name**: `theme-predictor-api`
   - **Root Directory**: `flask_api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. Click **Create Web Service**.
6. Wait for the build to complete. Once finished, Render will provide a URL (e.g., `https://theme-predictor-api.onrender.com`).

## 3. Update the Node.js Backend

Your Node.js backend needs to know where the new Flask API is hosted.

1. Go to the dashboard of your **Node.js backend on Render**.
2. Navigate to your Web Service settings and click on **Environment**.
3. Add a new Environment Variable:
   - **Key**: `FLASK_API_URL`
   - **Value**: The URL you got from step 2 (e.g., `https://theme-predictor-api.onrender.com`). *Ensure there is no trailing slash.*
4. Render will usually auto-deploy when environment variables change. If not, manually deploy your latest commit.

## 4. Test the Integration

1. Go to your live frontend website.
2. Enter a prompt like `"Green Energy"` and click the **✨ AI Suggest Theme & Generate** button.
3. You should see a suggestion modal pop up saying "Theme Suggested! Based on your prompt, our AI recommends the **Eco Nature** theme...".
4. You can click "Accept & Generate" to proceed.

> [!WARNING]
> Free tier servers on Render sleep after inactivity. The very first request to predict a theme after a period of inactivity might take ~30 seconds to wake up. To fix this, you can upgrade to a paid tier or use a cron job to keep it awake.
