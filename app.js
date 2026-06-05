// ─────────────────────────────────────────
//  VoiceForm · app.js  (camera fixed)
// ─────────────────────────────────────────

let recognition  = null;
let activeField  = null;
let cameraStream = null;
let photoData    = null;

// ══════════════════════════════════════════
//  VOICE RECOGNITION
// ══════════════════════════════════════════

function startVoice(fieldId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    toast("❌ Use Chrome or Edge for voice input.", "err");
    return;
  }

  if (activeField === fieldId && recognition) {
    recognition.stop();
    return;
  }

  if (recognition) { recognition.stop(); recognition = null; }

  activeField = fieldId;
  recognition = new SR();
  recognition.lang            = 'en-IN';
  recognition.interimResults  = true;
  recognition.continuous      = false;
  recognition.maxAlternatives = 1;

  const input    = document.getElementById(fieldId);
  const dot      = document.getElementById('statusDot');
  const statusTx = document.getElementById('statusText');

  setMicActive(fieldId, true);
  input.classList.add('active');
  dot.className        = 'dot listening';
  statusTx.textContent = `🎤 Listening for "${fieldId}" — speak now...`;

  recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    input.value = final ? clean(fieldId, final.trim()) : interim;
    if (final) {
      input.value          = clean(fieldId, final.trim());
      dot.className        = 'dot done';
      statusTx.textContent = `✔ "${fieldId}" filled: ${input.value}`;
      setTimeout(resetStatus, 3000);
    }
  };

  recognition.onerror = (e) => {
    setMicActive(fieldId, false);
    input.classList.remove('active');
    resetStatus();
    if      (e.error === 'not-allowed') toast("🎤 Microphone blocked — allow it in browser.", "err");
    else if (e.error === 'no-speech')   toast("No speech detected. Try again.", "err");
    else                                toast("Voice error: " + e.error, "err");
  };

  recognition.onend = () => {
    setMicActive(fieldId, false);
    input.classList.remove('active');
    activeField = null;
  };

  recognition.start();
}

function clean(field, text) {
  switch (field) {
    case 'email':
      return text.toLowerCase()
        .replace(/\bat\b/g,  '@')
        .replace(/\bdot\b/g, '.')
        .replace(/\s+/g, '');

    case 'phone':
      const digitWords = {
        zero:'0', one:'1', two:'2', three:'3', four:'4',
        five:'5', six:'6', seven:'7', eight:'8', nine:'9'
      };
      let p = text.toLowerCase();
      for (const [w, d] of Object.entries(digitWords))
        p = p.replace(new RegExp('\\b' + w + '\\b', 'g'), d);
      return p.replace(/[^\d+]/g, '');

    case 'age':
      const nums = {
        zero:0, one:1, two:2, three:3, four:4, five:5,
        six:6, seven:7, eight:8, nine:9, ten:10,
        eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
        sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20,
        'twenty one':21,'twenty two':22,'twenty three':23,
        'twenty four':24,'twenty five':25,'twenty six':26,
        'twenty seven':27,'twenty eight':28,'twenty nine':29,
        thirty:30, forty:40, fifty:50, sixty:60,
        seventy:70, eighty:80, ninety:90
      };
      const lo = text.toLowerCase();
      for (const [w, n] of Object.entries(nums))
        if (lo.includes(w)) return String(n);
      return text.replace(/\D/g, '');

    case 'name':
      return text.replace(/\b\w/g, c => c.toUpperCase()).trim();

    default:
      return text.trim();
  }
}

function setMicActive(fieldId, on) {
  document.querySelectorAll('.mic').forEach(b => b.classList.remove('active'));
  if (!on) return;
  const btn = document.getElementById(fieldId)?.parentElement?.querySelector('.mic');
  if (btn) btn.classList.add('active');
}

function resetStatus() {
  const dot = document.getElementById('statusDot');
  const tx  = document.getElementById('statusText');
  if (dot) dot.className   = 'dot';
  if (tx)  tx.textContent  = 'Click 🎤 and speak into any field';
}

// ══════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════

function goToCamera() {
  const name  = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!name)  { toast("Please fill in your Name.",  "err"); return; }
  if (!email) { toast("Please fill in your Email.", "err"); return; }
  if (!phone) { toast("Please fill in your Phone.", "err"); return; }

  show('formSection',   false);
  show('cameraSection', true);
  setStep(1, 'done');
  setStep(2, 'active');

  startCamera();
}

function goBack() {
  stopCamera();
  photoData = null;
  show('cameraSection', false);
  show('formSection',   true);
  show('previewBox',    false);
  show('camStatus',     false);
  document.getElementById('captureBtn').style.display = '';
  document.getElementById('retakeBtn').style.display  = 'none';
  document.getElementById('submitBtn').style.display  = 'none';
  setStep(2, '');
  setStep(1, 'active');

  // remove retry button if present
  const rb = document.getElementById('retryCamBtn');
  if (rb) rb.remove();
}

// ══════════════════════════════════════════
//  CAMERA — FULLY FIXED
// ══════════════════════════════════════════

async function startCamera() {
  const video = document.getElementById('video');

  // Hide old retry button
  const old = document.getElementById('retryCamBtn');
  if (old) old.remove();

  // Show loading state
  show('camStatus', true);
  document.getElementById('camStatusText').textContent = '⏳ Starting camera...';

  // List of constraint attempts — tries simpler ones if first fails
  const attempts = [
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false }
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log(`Camera attempt ${i + 1}...`);

      // Stop any old stream first
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
      }

      cameraStream = await navigator.mediaDevices.getUserMedia(attempts[i]);

      video.srcObject = cameraStream;
      video.style.display = 'block';

      // Wait for video metadata to load
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror          = (e) => reject(new Error("Video load error"));
        setTimeout(() => resolve(), 4000); // max wait 4s
      });

      // Play the video
      try { await video.play(); } catch (pe) { console.warn("Play warning:", pe); }

      console.log(`✅ Camera started on attempt ${i + 1}`);
      document.getElementById('camStatusText').textContent = '✔ Camera ready — position your face and click Capture';
      toast("Camera ready!", "ok");
      return; // ✅ success

    } catch (err) {
      console.warn(`Attempt ${i + 1} failed:`, err.name, "—", err.message);

      // Handle specific errors immediately
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        cameraFailed("Camera permission denied. Click the 🔒 lock icon in address bar → Allow Camera → Reload.");
        return;
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        cameraFailed("No camera found on this device.");
        return;
      }

      // Otherwise try next constraint set
      cameraStream = null;
    }
  }

  // All 4 attempts failed
  cameraFailed("Camera is in use by another app (Zoom, Teams, etc.). Close them and click Retry.");
}

function cameraFailed(message) {
  console.error("Camera failed:", message);
  toast("❌ " + message, "err");

  show('camStatus', true);
  document.getElementById('camStatusText').textContent = "⚠️ " + message;

  // Add retry button if not already there
  if (!document.getElementById('retryCamBtn')) {
    const btn = document.createElement('button');
    btn.id          = 'retryCamBtn';
    btn.className   = 'btn-primary';
    btn.textContent = '🔄 Retry Camera';
    btn.style.marginTop = '12px';
    btn.onclick = () => startCamera();
    document.getElementById('cameraSection').appendChild(btn);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('video');
  video.srcObject = null;
}

function capturePhoto() {
  const video  = document.getElementById('video');
  const canvas = document.getElementById('canvas');

  if (!cameraStream) {
    toast("Camera not ready. Please wait.", "err");
    return;
  }

  if (!video.videoWidth || video.videoWidth === 0) {
    toast("Camera still loading. Wait a moment.", "err");
    return;
  }

  const ctx     = canvas.getContext('2d');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  photoData = canvas.toDataURL('image/jpeg', 0.85);

  if (!photoData || photoData.length < 1000) {
    toast("Photo capture failed. Try again.", "err");
    return;
  }

  // Show preview
  document.getElementById('previewImg').src = photoData;
  show('previewBox', true);

  // Swap buttons
  document.getElementById('captureBtn').style.display = 'none';
  document.getElementById('retakeBtn').style.display  = '';
  document.getElementById('submitBtn').style.display  = '';

  document.getElementById('camStatusText').textContent = '📸 Photo captured — click Submit to save';
  toast("Photo captured!", "ok");
}

function retakePhoto() {
  photoData = null;
  show('previewBox', false);
  document.getElementById('previewImg').src = '';
  document.getElementById('captureBtn').style.display = '';
  document.getElementById('retakeBtn').style.display  = 'none';
  document.getElementById('submitBtn').style.display  = 'none';
  document.getElementById('camStatusText').textContent = '✔ Camera ready — position your face and click Capture';
  toast("Position your face and capture again.", "");
}

// ══════════════════════════════════════════
//  SUBMIT
// ══════════════════════════════════════════

async function submitForm() {
  if (!photoData) {
    toast("Please capture your photo first.", "err");
    return;
  }

  const payload = {
    name:    document.getElementById('name').value.trim(),
    email:   document.getElementById('email').value.trim(),
    phone:   document.getElementById('phone').value.trim(),
    age:     document.getElementById('age').value.trim(),
    address: document.getElementById('address').value.trim(),
    photo:   photoData
  };

  if (!payload.name)  { toast("Name is required.",  "err"); return; }
  if (!payload.email) { toast("Email is required.", "err"); return; }
  if (!payload.phone) { toast("Phone is required.", "err"); return; }

  console.log("Submitting:", payload.name, payload.email, payload.phone);
  toast("Saving...", "");

  // Disable submit button to avoid double clicks
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled     = true;
  submitBtn.textContent  = '⏳ Saving...';

  try {
    const res = await fetch('/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    console.log("Server status:", res.status);
    const text = await res.text();
    console.log("Server response:", text);

    if (!res.ok) {
      submitBtn.disabled    = false;
      submitBtn.textContent = '✅ Submit';
      throw new Error(text || `Server error ${res.status}`);
    }

    let data;
    try   { data = JSON.parse(text); }
    catch { throw new Error("Invalid response from server."); }

    stopCamera();
    showSuccess(payload, data.filename, data.id);

  } catch (err) {
    console.error("Submit error:", err);
    toast("❌ " + err.message, "err");
    submitBtn.disabled    = false;
    submitBtn.textContent = '✅ Submit';
  }
}

// ══════════════════════════════════════════
//  SUCCESS
// ══════════════════════════════════════════

function showSuccess(data, filename, id) {
  show('cameraSection',  false);
  show('successSection', true);
  setStep(2, 'done');
  setStep(3, 'active');

  document.getElementById('infoBox').innerHTML = `
    <b>Saved Entry</b><br>
    ID &nbsp;&nbsp;&nbsp;&nbsp;: <span>${id || '—'}</span><br>
    Name &nbsp;&nbsp;: <span>${data.name}</span><br>
    Email &nbsp;: <span>${data.email}</span><br>
    Phone &nbsp;: <span>${data.phone}</span><br>
    Age &nbsp;&nbsp;&nbsp;: <span>${data.age     || '—'}</span><br>
    Address: <span>${data.address || '—'}</span><br>
    Photo &nbsp;: <span>${filename  || 'none'}</span>
  `;
}

function resetAll() {
  ['name','email','phone','age','address'].forEach(id => {
    document.getElementById(id).value = '';
  });

  photoData = null;
  show('successSection', false);
  show('formSection',    true);
  show('previewBox',     false);
  show('camStatus',      false);

  document.getElementById('captureBtn').style.display   = '';
  document.getElementById('retakeBtn').style.display    = 'none';
  document.getElementById('submitBtn').style.display    = 'none';
  document.getElementById('submitBtn').disabled         = false;
  document.getElementById('submitBtn').textContent      = '✅ Submit';
  document.getElementById('previewImg').src             = '';

  const rb = document.getElementById('retryCamBtn');
  if (rb) rb.remove();

  setStep(1, 'active');
  setStep(2, '');
  setStep(3, '');
  resetStatus();
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════

function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'block' : 'none';
}

function setStep(num, state) {
  const el = document.getElementById('step' + num);
  if (!el) return;
  el.className = 'step' + (state ? ' ' + state : '');
}

let _toastTimer = null;
function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

// Auto-check camera availability on page load
window.addEventListener('load', () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("getUserMedia not supported — needs HTTPS or localhost");
  }
});