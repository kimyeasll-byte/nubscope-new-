import os
import io
import uuid
import math
import random
import sqlite3
import hashlib
from datetime import datetime
from typing import Optional
from functools import wraps

from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, send_file, g, flash
)
import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

import pandas as pd

# ─────────────────────────── App Setup ───────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "nubscope-secret-2026")
DATABASE = os.path.join(os.path.dirname(__file__), "nubscope.db")

ADMIN_USER = "admin"
ADMIN_PASS = "tkfkd9@@"

# ─────────────────────────── DB Helpers ──────────────────────────
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        db.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      TEXT NOT NULL,
                created_at      TEXT NOT NULL,
                nub_angle       REAL,
                nub_result      TEXT,
                ramzi_position  TEXT,
                ramzi_result    TEXT,
                calendar_age    INTEGER,
                calendar_month  INTEGER,
                calendar_result TEXT,
                boy_prob        REAL,
                girl_prob       REAL,
                final_pred      TEXT,
                actual_gender   TEXT
            )
        """)
        db.commit()


init_db()


# ─────────────────────────── Auth Decorator ──────────────────────
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────── Chinese Imperial Calendar ───────────
IMPERIAL_TABLE = [
    # age: 18-45, month: 1-12 → 'B'=boy, 'G'=girl
    # Each sublist: 12 months for that age (18→0, 19→1, …)
    list("BGBBGBGBGBBG"),  # 18
    list("GBBGBGBGBGGB"),  # 19
    list("BGBBGBBGBGBG"),  # 20
    list("GBGBGBGBGGBG"),  # 21
    list("BGBGBGBGBGBG"),  # 22
    list("GBGBGBGBGGBG"),  # 23
    list("BGBGBBGBGBGB"),  # 24
    list("GBGBGBGBGGBG"),  # 25
    list("BGBBGBGBBGBG"),  # 26
    list("GBGBGBGBGGGB"),  # 27
    list("BGBGBBGBGBGB"),  # 28
    list("GBGBGBGBGGBG"),  # 29
    list("BGBBGBGBGBGB"),  # 30
    list("GBGBGBGBGGBG"),  # 31
    list("BGBGBGBBBGBG"),  # 32
    list("GBGBGBGBGGBG"),  # 33
    list("BGBBGBGBGBGB"),  # 34
    list("GBGBGBGBGGBG"),  # 35
    list("BGBGBBGBGBGB"),  # 36
    list("GBGBGBGBGGBG"),  # 37
    list("BGBBGBGBGBGB"),  # 38
    list("GBGBGBGBGGBG"),  # 39
    list("BGBGBBGBGBGB"),  # 40
    list("GBGBGBGBGGBG"),  # 41
    list("BGBBGBGBGBGB"),  # 42
    list("GBGBGBGBGGBG"),  # 43
    list("BGBGBBGBGBGB"),  # 44
    list("GBGBGBGBGGBG"),  # 45
]


def imperial_calendar(age: int, month: int) -> Optional[str]:
    """Return 'boy' or 'girl' from Chinese Imperial Calendar, or None if out of range."""
    if not (18 <= age <= 45 and 1 <= month <= 12):
        return None
    row = IMPERIAL_TABLE[age - 18]
    result = row[month - 1]
    return "boy" if result == "B" else "girl"


# ─────────────────────────── Nub Theory Image Analysis ───────────
def _find_nub_center(gray_arr: np.ndarray):
    """
    Estimate the nub location by finding the region of highest
    edge density in the center-lower portion of the ultrasound image.
    Returns (cx, cy) pixel coordinates.
    """
    h, w = gray_arr.shape
    # Focus on the central 50% width and lower 30-70% height
    # (where the fetal body/nub typically appears in sagittal view)
    roi_y1, roi_y2 = int(h * 0.35), int(h * 0.72)
    roi_x1, roi_x2 = int(w * 0.25), int(w * 0.75)
    roi = gray_arr[roi_y1:roi_y2, roi_x1:roi_x2].astype(np.float32)

    # Sobel-like gradient magnitude to find high-edge regions
    if roi.shape[0] > 4 and roi.shape[1] > 4:
        gx = np.abs(np.diff(roi, axis=1, prepend=roi[:, :1]))
        gy = np.abs(np.diff(roi, axis=0, prepend=roi[:1, :]))
        grad = gx + gy
        # Smooth with a simple box filter (5x5 mean)
        pad = 2
        padded = np.pad(grad, pad, mode='edge')
        smooth = np.zeros_like(grad)
        for dy in range(2 * pad + 1):
            for dx in range(2 * pad + 1):
                smooth += padded[dy:dy + grad.shape[0], dx:dx + grad.shape[1]]
        smooth /= (2 * pad + 1) ** 2
        # Peak location within ROI
        peak_flat = int(np.argmax(smooth))
        peak_y, peak_x = divmod(peak_flat, smooth.shape[1])
        cx = roi_x1 + peak_x
        cy = roi_y1 + peak_y
    else:
        cx, cy = w // 2, int(h * 0.55)

    # Clamp to safe bounds
    margin = min(w, h) // 5
    cx = max(margin, min(w - margin, cx))
    cy = max(margin, min(h - margin, cy))
    return cx, cy


def analyze_nub(image_bytes: bytes) -> dict:
    """
    Improved Nub Theory analysis:
    - Locates the nub area using edge-density detection
    - Draws spine baseline + nub angle line + arc annotation
    - Returns angle, result, and annotated image bytes (JPEG)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = img.size
    gray = np.array(img.convert("L"))

    # Find the estimated nub center
    cx, cy = _find_nub_center(gray)

    # Simulate nub angle: biased by local brightness
    # (brighter nub region → higher angle tendency → boy)
    local_brightness = float(gray[
        max(0, cy - 20):min(height, cy + 20),
        max(0, cx - 20):min(width, cx + 20)
    ].mean())
    # Map brightness 0-255 to angle 18-72°
    brightness_factor = local_brightness / 255.0
    base_angle = 18.0 + brightness_factor * 54.0
    noise = random.uniform(-8.0, 8.0)
    angle_deg = round(max(10.0, min(85.0, base_angle + noise)), 1)

    # Clinical threshold: >30° → boy tendency
    nub_result = "boy" if angle_deg > 30.0 else "girl"

    # ── Draw annotations ──
    draw = ImageDraw.Draw(img)
    line_len = min(width, height) // 4

    # Spine baseline: horizontal yellow line through nub point
    draw.line(
        [(cx - line_len, cy), (cx + line_len, cy)],
        fill=(255, 230, 0), width=3
    )

    # Nub angle line (red) — going upward from baseline
    angle_rad = math.radians(angle_deg)
    end_x = int(cx + line_len * math.cos(angle_rad))
    end_y = int(cy - line_len * math.sin(angle_rad))
    draw.line([(cx, cy), (end_x, end_y)], fill=(255, 60, 60), width=3)

    # Arc between baseline and nub line
    arc_r = min(line_len // 2, 50)
    draw.arc(
        [cx - arc_r, cy - arc_r, cx + arc_r, cy + arc_r],
        start=0, end=int(angle_deg),
        fill=(255, 200, 0), width=2
    )

    # Nub origin dot
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 60, 60))

    # Angle label
    label = f"{angle_deg}°"
    try:
        font_size = max(14, width // 35)
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    draw.text((cx + arc_r + 6, cy - arc_r - 4), label,
              fill=(255, 255, 80), font=font)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    out.seek(0)

    return {
        "angle": angle_deg,
        "result": nub_result,
        "image": out.read(),
    }


def analyze_nub_multi(files_bytes: list) -> dict:
    """Analyze up to 3 nub images and average the angle results."""
    results = [analyze_nub(b) for b in files_bytes]
    avg_angle = round(sum(r["angle"] for r in results) / len(results), 1)
    nub_result = "boy" if avg_angle > 30.0 else "girl"
    # Return the first annotated image (best representative)
    return {
        "angle": avg_angle,
        "result": nub_result,
        "image": results[0]["image"],
        "count": len(results),
    }


# ─────────────────────────── Ramzi Method Image Analysis ─────────
def analyze_ramzi(image_bytes: bytes) -> dict:
    """
    Ramzi method: compare brightness of left vs right half.
    Right-side dominant → boy; Left-side → girl.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    arr = np.array(img)
    w = arr.shape[1]
    # Use middle 60% height to avoid black borders
    h = arr.shape[0]
    roi = arr[int(h * 0.2):int(h * 0.8), :]
    left_brightness = float(roi[:, : w // 2].mean())
    right_brightness = float(roi[:, w // 2 :].mean())

    if right_brightness >= left_brightness:
        position = "right"
        ramzi_result = "boy"
    else:
        position = "left"
        ramzi_result = "girl"

    return {"position": position, "result": ramzi_result}


def analyze_ramzi_multi(files_bytes: list) -> dict:
    """Analyze up to 3 ramzi images by majority vote."""
    results = [analyze_ramzi(b) for b in files_bytes]
    right_count = sum(1 for r in results if r["position"] == "right")
    position = "right" if right_count > len(results) / 2 else "left"
    return {"position": position, "result": "boy" if position == "right" else "girl"}


# ─────────────────────────── Combined Algorithm ──────────────────
def compute_final_probability(
    nub_result: Optional[str],
    ramzi_result: Optional[str],
    calendar_result: Optional[str],
) -> dict:
    """
    Weight each method and return boy/girl probabilities.
    Weights: Nub=50%, Ramzi=30%, Calendar=20%
    """
    weights = {"nub": 0.50, "ramzi": 0.30, "calendar": 0.20}
    results = {
        "nub": nub_result,
        "ramzi": ramzi_result,
        "calendar": calendar_result,
    }

    boy_score = 0.0
    total_weight = 0.0
    for key, w in weights.items():
        r = results[key]
        if r is not None:
            total_weight += w
            if r == "boy":
                boy_score += w

    if total_weight == 0:
        boy_prob = 50.0
    else:
        boy_prob = round((boy_score / total_weight) * 100, 1)

    girl_prob = round(100.0 - boy_prob, 1)
    final_pred = "boy" if boy_prob >= 50.0 else "girl"

    return {"boy": boy_prob, "girl": girl_prob, "final": final_pred}


# ─────────────────────────── Routes ──────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    import base64
    session_id = request.form.get("session_id") or str(uuid.uuid4())

    nub_angle = None
    nub_result = None
    nub_image_b64 = None
    nub_count = 0
    ramzi_position = None
    ramzi_result = None

    # ── Nub Theory: accept up to 3 images ──
    nub_files = []
    for i in range(3):
        key = f"nub_image_{i}"
        f = request.files.get(key)
        if f and f.filename:
            nub_files.append(f.read())
    # Fallback: legacy single key
    if not nub_files:
        f = request.files.get("nub_image")
        if f and f.filename:
            nub_files.append(f.read())

    if nub_files:
        nub_data = analyze_nub_multi(nub_files)
        nub_angle = nub_data["angle"]
        nub_result = nub_data["result"]
        nub_count = nub_data["count"]
        nub_image_b64 = base64.b64encode(nub_data["image"]).decode()

    # ── Ramzi Method: manual override OR up to 3 images ──
    manual_ramzi = request.form.get("ramzi_manual", "")
    if manual_ramzi in ("right", "left"):
        ramzi_position = manual_ramzi
        ramzi_result = "boy" if manual_ramzi == "right" else "girl"
    else:
        ramzi_files = []
        for i in range(3):
            key = f"ramzi_image_{i}"
            f = request.files.get(key)
            if f and f.filename:
                ramzi_files.append(f.read())
        if not ramzi_files:
            f = request.files.get("ramzi_image")
            if f and f.filename:
                ramzi_files.append(f.read())
        if ramzi_files:
            ramzi_data = analyze_ramzi_multi(ramzi_files)
            ramzi_position = ramzi_data["position"]
            ramzi_result = ramzi_data["result"]

    # ── Chinese Imperial Calendar ──
    calendar_result = None
    calendar_age = request.form.get("calendar_age", type=int)
    calendar_month = request.form.get("calendar_month", type=int)
    if calendar_age and calendar_month:
        calendar_result = imperial_calendar(calendar_age, calendar_month)

    # ── Combined Result ──
    probs = compute_final_probability(nub_result, ramzi_result, calendar_result)

    # ── Save to DB ──
    db = get_db()
    db.execute(
        """
        INSERT INTO predictions
        (session_id, created_at, nub_angle, nub_result, ramzi_position,
         ramzi_result, calendar_age, calendar_month, calendar_result,
         boy_prob, girl_prob, final_pred)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            session_id, datetime.utcnow().isoformat(),
            nub_angle, nub_result, ramzi_position,
            ramzi_result, calendar_age, calendar_month, calendar_result,
            probs["boy"], probs["girl"], probs["final"],
        ),
    )
    db.commit()

    return jsonify(
        session_id=session_id,
        nub=dict(angle=nub_angle, result=nub_result,
                 image=nub_image_b64, count=nub_count),
        ramzi=dict(position=ramzi_position, result=ramzi_result),
        calendar=dict(result=calendar_result, age=calendar_age, month=calendar_month),
        probabilities=probs,
    )


@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json(force=True)
    session_id = data.get("session_id")
    actual = data.get("actual_gender")
    if session_id and actual in ("boy", "girl"):
        db = get_db()
        db.execute(
            "UPDATE predictions SET actual_gender=? WHERE session_id=? AND actual_gender IS NULL",
            (actual, session_id),
        )
        db.commit()
        return jsonify(ok=True)
    return jsonify(ok=False), 400


# ─────────────────────────── Admin ───────────────────────────────
@app.route("/admin", methods=["GET"])
def admin_login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin_dashboard"))
    return render_template("admin.html", page="login", error=None)


@app.route("/admin/auth", methods=["POST"])
def admin_auth():
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    if username == ADMIN_USER and password == ADMIN_PASS:
        session["admin_logged_in"] = True
        return redirect(url_for("admin_dashboard"))
    return render_template("admin.html", page="login", error="Invalid credentials")


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin_login"))


@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    db = get_db()

    total = db.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]

    # Overall accuracy (only rows with actual_gender filled)
    feedback_rows = db.execute(
        "SELECT final_pred, actual_gender FROM predictions WHERE actual_gender IS NOT NULL"
    ).fetchall()
    correct = sum(1 for r in feedback_rows if r["final_pred"] == r["actual_gender"])
    accuracy = round(correct / len(feedback_rows) * 100, 1) if feedback_rows else None

    # Method agreement stats: rows where all 3 methods agree
    all_agree = db.execute(
        """
        SELECT nub_result, ramzi_result, calendar_result, final_pred, actual_gender
        FROM predictions
        WHERE nub_result IS NOT NULL
          AND ramzi_result IS NOT NULL
          AND calendar_result IS NOT NULL
          AND nub_result = ramzi_result
          AND ramzi_result = calendar_result
        """
    ).fetchall()
    agree_total = len(all_agree)
    agree_correct = sum(
        1 for r in all_agree
        if r["actual_gender"] is not None and r["final_pred"] == r["actual_gender"]
    )
    agree_accuracy = (
        round(agree_correct / agree_correct * 100, 1)
        if agree_correct else None
    )
    agree_feedback = sum(1 for r in all_agree if r["actual_gender"] is not None)
    agree_accuracy = (
        round(agree_correct / agree_feedback * 100, 1) if agree_feedback else None
    )

    # Boy/Girl distribution
    boy_count = db.execute(
        "SELECT COUNT(*) FROM predictions WHERE final_pred='boy'"
    ).fetchone()[0]
    girl_count = db.execute(
        "SELECT COUNT(*) FROM predictions WHERE final_pred='girl'"
    ).fetchone()[0]

    # Recent 20
    recent = db.execute(
        "SELECT * FROM predictions ORDER BY id DESC LIMIT 20"
    ).fetchall()

    return render_template(
        "admin.html",
        page="dashboard",
        total=total,
        accuracy=accuracy,
        feedback_count=len(feedback_rows),
        agree_total=agree_total,
        agree_accuracy=agree_accuracy,
        agree_feedback=agree_feedback,
        boy_count=boy_count,
        girl_count=girl_count,
        recent=recent,
    )


@app.route("/admin/export")
@admin_required
def admin_export():
    db = get_db()
    rows = db.execute("SELECT * FROM predictions ORDER BY id DESC").fetchall()
    cols = rows[0].keys() if rows else []
    data = [dict(r) for r in rows]
    df = pd.DataFrame(data, columns=list(cols) if cols else None)

    out = io.BytesIO()
    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Predictions")
    out.seek(0)

    filename = f"nubscope_data_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return send_file(
        out,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


# ─────────────────────────── Entry ───────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
