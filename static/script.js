/* ═══════════════════════════════════════════════
   NubScope — Frontend Logic & i18n
   ═══════════════════════════════════════════════ */

/* ── Translations ── */
const i18n = {
  ko: {
    tagline: "초음파 사진으로 태아 성별을 예측해보세요",
    subtitle: "각도법 + 램지법 + 중국 황실 달력으로 종합 분석",
    notice1: "임신 10~14주차 초음파 사진을 업로드하시면 예측 정확도가 더욱 높아집니다.",
    notice2: "본 서비스는 사용자의 사진이나 개인정보를 서버에 저장하지 않으며 분석 즉시 폐기합니다.",
    notice3: "본 결과는 재미와 참고용이며, 의학적 판단을 대체할 수 없습니다.",
    nubTitle: "각도법 (Nub Theory)",
    nubDesc: "초음파 이미지를 업로드하면 AI가 생식기 결절 각도를 자동 분석합니다.",
    uploadHint: "클릭하거나 이미지를 드래그하세요",
    uploadSub: "JPG, PNG, WebP · 최대 10MB",
    ramziTitle: "램지법 (Ramzi Method)",
    ramziDesc: "초음파 이미지를 업로드하거나 태반 위치를 직접 선택하세요.",
    ramziManual: "직접 선택:",
    ramziRight: "오른쪽",
    ramziLeft: "왼쪽",
    ramziUnknown: "모름 (자동 분석)",
    calTitle: "중국 황실 달력",
    calDesc: "산모의 만나이(음력)와 임신한 음력 월을 입력하세요.",
    calAge: "산모 만나이 (음력)",
    calMonth: "임신 음력 월 (1~12)",
    analyzeBtn: "🔮 성별 예측하기",
    analyzingBtn: "분석 중...",
    resultTitle: "예측 결과",
    boyLabel: "남아",
    girlLabel: "여아",
    boyResult: "🔵 남아 예측",
    girlResult: "🌸 여아 예측",
    methodNub: "각도법",
    methodRamzi: "램지법",
    methodCalendar: "황실달력",
    noData: "데이터 없음",
    angle: "각도",
    placenta: "태반 위치",
    feedbackTitle: "실제 출산 후 알려주세요!",
    feedbackBoy: "실제로 남아였어요 🔵",
    feedbackGirl: "실제로 여아였어요 🌸",
    feedbackThanks: "소중한 피드백 감사합니다! 🙏",
    annoTitle: "AI 각도 분석 이미지",
    creator: "제작자",
  },
  en: {
    tagline: "Predict your baby's gender from ultrasound",
    subtitle: "Nub Theory + Ramzi Method + Chinese Imperial Calendar",
    notice1: "Uploading ultrasound images from weeks 10–14 of pregnancy improves prediction accuracy.",
    notice2: "This service does not store your photos or personal data. All uploads are deleted immediately after analysis.",
    notice3: "Results are for fun and reference only and cannot replace medical judgment.",
    nubTitle: "Nub Theory",
    nubDesc: "Upload an ultrasound image and AI will automatically analyze the genital nub angle.",
    uploadHint: "Click or drag your image here",
    uploadSub: "JPG, PNG, WebP · Max 10MB",
    ramziTitle: "Ramzi Method",
    ramziDesc: "Upload an ultrasound image or manually select the placenta position.",
    ramziManual: "Select manually:",
    ramziRight: "Right",
    ramziLeft: "Left",
    ramziUnknown: "Unknown (auto-detect)",
    calTitle: "Chinese Imperial Calendar",
    calDesc: "Enter the mother's lunar age and lunar month of conception.",
    calAge: "Mother's lunar age",
    calMonth: "Lunar conception month (1–12)",
    analyzeBtn: "🔮 Predict Gender",
    analyzingBtn: "Analyzing...",
    resultTitle: "Prediction Result",
    boyLabel: "Boy",
    girlLabel: "Girl",
    boyResult: "🔵 Boy Predicted",
    girlResult: "🌸 Girl Predicted",
    methodNub: "Nub Theory",
    methodRamzi: "Ramzi",
    methodCalendar: "Imp. Calendar",
    noData: "No data",
    angle: "Angle",
    placenta: "Placenta",
    feedbackTitle: "Tell us after birth!",
    feedbackBoy: "It was a Boy! 🔵",
    feedbackGirl: "It was a Girl! 🌸",
    feedbackThanks: "Thank you for your feedback! 🙏",
    annoTitle: "AI Angle Analysis",
    creator: "Creator",
  },
};

let lang = localStorage.getItem("nubscope_lang") || "ko";
let currentSessionId = null;

/* ── Language Toggle ── */
function setLang(l) {
  lang = l;
  localStorage.setItem("nubscope_lang", l);
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (i18n[lang][key] !== undefined) el.textContent = i18n[lang][key];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    if (i18n[lang][key] !== undefined) el.placeholder = i18n[lang][key];
  });
  document.getElementById("btn-ko").classList.toggle("active", l === "ko");
  document.getElementById("btn-en").classList.toggle("active", l === "en");
}

document.addEventListener("DOMContentLoaded", () => {
  setLang(lang);

  document.getElementById("btn-ko").addEventListener("click", () => setLang("ko"));
  document.getElementById("btn-en").addEventListener("click", () => setLang("en"));

  // Upload zones
  setupUpload("nub-upload-zone", "nub-file-input", "nub-preview");
  setupUpload("ramzi-upload-zone", "ramzi-file-input", "ramzi-preview");

  // Ramzi manual select
  document.querySelectorAll('input[name="ramzi_manual"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const isAuto = radio.value === "auto";
      document.getElementById("ramzi-upload-zone").style.opacity = isAuto ? "1" : "0.4";
      document.getElementById("ramzi-upload-zone").style.pointerEvents = isAuto ? "all" : "none";
    });
  });

  // Main form
  document.getElementById("predict-form").addEventListener("submit", handleSubmit);

  // Feedback buttons
  document.getElementById("fb-boy").addEventListener("click", () => submitFeedback("boy"));
  document.getElementById("fb-girl").addEventListener("click", () => submitFeedback("girl"));
});

/* ── Upload Zone Setup ── */
function setupUpload(zoneId, inputId, previewId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) showPreview(file, preview);
  });
  input.addEventListener("change", () => {
    if (input.files[0]) showPreview(input.files[0], preview);
  });
}

function showPreview(file, previewEl) {
  const reader = new FileReader();
  reader.onload = e => {
    previewEl.querySelector("img").src = e.target.result;
    previewEl.style.display = "block";
  };
  reader.readAsDataURL(file);
}

/* ── Form Submit ── */
async function handleSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById("analyze-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  const fd = new FormData();
  currentSessionId = currentSessionId || crypto.randomUUID?.() || Date.now().toString();
  fd.append("session_id", currentSessionId);
  fd.append("method", "all");

  const nubFile = document.getElementById("nub-file-input").files[0];
  if (nubFile) fd.append("nub_image", nubFile);

  // Ramzi
  const ramziManual = document.querySelector('input[name="ramzi_manual"]:checked')?.value || "auto";
  if (ramziManual !== "auto") {
    fd.append("ramzi_manual", ramziManual);
  } else {
    const ramziFile = document.getElementById("ramzi-file-input").files[0];
    if (ramziFile) fd.append("ramzi_image", ramziFile);
  }

  // Calendar
  const age = document.getElementById("cal-age").value;
  const month = document.getElementById("cal-month").value;
  if (age) fd.append("calendar_age", age);
  if (month) fd.append("calendar_month", month);

  try {
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    alert("Analysis failed. Please try again.");
    console.error(err);
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ── Render Results ── */
function renderResults(data) {
  const section = document.getElementById("results-section");
  const probs = data.probabilities;

  // Prediction badge
  const badge = document.getElementById("prediction-badge");
  badge.className = "prediction-badge " + probs.final;
  badge.textContent = probs.final === "boy" ? i18n[lang].boyResult : i18n[lang].girlResult;

  // Progress bars — animate after DOM paint
  setTimeout(() => {
    document.getElementById("bar-boy").style.width = probs.boy + "%";
    document.getElementById("bar-girl").style.width = probs.girl + "%";
  }, 100);
  document.getElementById("pct-boy").textContent = probs.boy + "%";
  document.getElementById("pct-girl").textContent = probs.girl + "%";

  // Method cards
  setMethodCard("mc-nub", data.nub?.result, () => {
    const angle = data.nub?.angle ? `${data.nub.angle}°` : "";
    return angle;
  });
  setMethodCard("mc-ramzi", data.ramzi?.result, () => {
    const pos = data.ramzi?.position;
    if (!pos) return "";
    return lang === "ko" ? (pos === "right" ? "오른쪽" : "왼쪽") : (pos === "right" ? "Right" : "Left");
  });
  setMethodCard("mc-cal", data.calendar?.result);

  // Annotated nub image
  if (data.nub?.image) {
    const imgWrap = document.getElementById("annotated-img-wrap");
    document.getElementById("annotated-img").src = "data:image/jpeg;base64," + data.nub.image;
    imgWrap.style.display = "block";
  }

  // Store session id for feedback
  if (data.session_id) currentSessionId = data.session_id;

  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setMethodCard(cardId, result, subFn) {
  const card = document.getElementById(cardId);
  const valEl = card.querySelector(".m-val");
  const subEl = card.querySelector(".m-sub");
  if (!result) {
    valEl.textContent = i18n[lang].noData;
    valEl.className = "m-val none";
    if (subEl) subEl.textContent = "";
    return;
  }
  valEl.textContent = result === "boy" ? i18n[lang].boyLabel : i18n[lang].girlLabel;
  valEl.className = "m-val " + result;
  if (subEl && subFn) subEl.textContent = subFn();
}

/* ── Feedback ── */
async function submitFeedback(gender) {
  if (!currentSessionId) return;
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId, actual_gender: gender }),
  });
  if (res.ok) {
    document.getElementById("feedback-row").innerHTML =
      `<p style="color:var(--muted);font-size:.9rem;">${i18n[lang].feedbackThanks}</p>`;
  }
}
