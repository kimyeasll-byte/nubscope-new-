# NubScope — Fetal Gender Predictor

A modern Black & White web service that predicts fetal gender using three scientific methods:
**Nub Theory**, **Ramzi Method**, and the **Chinese Imperial Calendar**.

---

## 🚀 Render Deployment Guide

### Prerequisites
1. A free [Render](https://render.com) account.
2. This repository pushed to GitHub or GitLab.

### Steps

1. **Create a New Web Service** on Render → `New` → `Web Service`.
2. **Connect your repository**.
3. Set the following:
   | Field | Value |
   |---|---|
   | **Environment** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `gunicorn app:app` |
   | **Instance Type** | Free (or Starter+) |

4. Add an **Environment Variable**:
   - `SECRET_KEY` → any random string (e.g., `my-super-secret-key-2026`)

5. Click **Deploy**. Render will build and start automatically.

> **Note:** The SQLite database (`nubscope.db`) is stored on Render's ephemeral disk.  
> For persistent storage, upgrade to a Render Disk or migrate to PostgreSQL.

---

## 🛠 Local Development

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run dev server
python app.py
```

Open `http://localhost:5000` in your browser.

---

## 🔐 Admin Access

| URL | `/admin` |
|---|---|
| Username | `admin` |
| Password | `tkfkd9@@` |

---

## 📂 Project Structure

```
NubScope/
├── app.py                  # Flask backend
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── nubscope.db             # SQLite DB (auto-created)
├── templates/
│   ├── index.html          # Main user interface
│   └── admin.html          # Admin dashboard
└── static/
    ├── style.css           # Anti-gravity B&W design
    └── script.js           # Frontend logic & i18n
```

---

## ⚠️ Disclaimer

This service is for entertainment and reference purposes only.  
Results DO NOT constitute medical advice.

---

**Creator:** [wevwev.tistory.com](https://wevwev.tistory.com)
