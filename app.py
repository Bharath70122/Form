import os
import json
import base64
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

SAVE_FILE  = "registrations.json"
PHOTOS_DIR = "photos"
os.makedirs(PHOTOS_DIR, exist_ok=True)


# ── JSON helpers ──────────────────────────────────────────────

def read_data():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def write_data(records):
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)


# ── Routes ────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/submit", methods=["POST"])
def submit():
    try:
        body = request.get_json(force=True, silent=True)
        if not body:
            return jsonify({"error": "No data received"}), 400

        name     = (body.get("name")    or "").strip()
        email    = (body.get("email")   or "").strip()
        phone    = (body.get("phone")   or "").strip()
        age      = (body.get("age")     or "").strip()
        address  = (body.get("address") or "").strip()
        photo_b64 = body.get("photo", "")

        print(f"\n--- New Submission ---")
        print(f"Name   : {name}")
        print(f"Email  : {email}")
        print(f"Phone  : {phone}")
        print(f"Age    : {age}")
        print(f"Address: {address}")
        print(f"Photo  : {'yes' if photo_b64 else 'no'}")

        # Validate
        errors = []
        if not name:  errors.append("name is required")
        if not email: errors.append("email is required")
        if not phone: errors.append("phone is required")
        if errors:
            return jsonify({"error": ", ".join(errors)}), 400

        # Save photo
        photo_filename = ""
        if photo_b64:
            # strip data URI header if present
            if "," in photo_b64:
                photo_b64 = photo_b64.split(",", 1)[1]
            
            # Strip any whitespace/newlines
            photo_b64 = photo_b64.strip()
            
            try:
                # Add padding if needed for base64 decoding
                missing_padding = len(photo_b64) % 4
                if missing_padding:
                    photo_b64 += "=" * (4 - missing_padding)
                img_bytes = base64.b64decode(photo_b64)
                photo_filename = uuid.uuid4().hex + ".jpg"
                photo_path = os.path.join(PHOTOS_DIR, photo_filename)
                with open(photo_path, "wb") as img_f:
                    img_f.write(img_bytes)
                print(f"Photo  : saved → {photo_path}")
            except Exception as pe:
                print(f"Photo save error: {pe}")
                return jsonify({"error": f"Photo save failed: {pe}"}), 500

        # Build entry
        entry = {
            "id":         str(uuid.uuid4()),
            "timestamp":  datetime.now().isoformat(timespec="seconds"),
            "name":       name,
            "email":      email,
            "phone":      phone,
            "age":        age,
            "address":    address,
            "photo_file": photo_filename
        }

        # Append and save
        records = read_data()
        records.append(entry)
        write_data(records)

        print(f"Saved  : entry #{len(records)} → {SAVE_FILE}")
        print(f"─────────────────────────────")

        return jsonify({
            "message":  "Registration saved successfully!",
            "id":       entry["id"],
            "filename": photo_filename
        }), 200

    except Exception as e:
        print(f"[SERVER ERROR] {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/registrations", methods=["GET"])
def get_all():
    """View all saved registrations at /registrations"""
    return jsonify(read_data()), 200


# ── Start ─────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "═"*40)
    print("  VoiceForm running!")
    print("  ➜  http://localhost:5000")
    print("  Data → registrations.json")
    print("  Photos → ./photos/")
    print("═"*40 + "\n")
    app.run(debug=True, host="0.0.0.0", port=5000)