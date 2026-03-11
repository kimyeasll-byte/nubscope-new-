/* ═══════════════════════════════════════════════
   NubScope — Frontend Logic & i18n (v2)
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
    nubDesc: "초음파 이미지를 최대 3장 업로드하면 AI가 생식기 결절 각도를 자동 분석합니다.",
    uploadHint: "클릭하거나 이미지를 드래그하세요",
    uploadSub: "JPG, PNG, WebP · 최대 10MB",
    ramziTitle: "램지법 (Ramzi Method)",
    ramziDesc: "초음파 이미지(최대 3장)를 업로드하거나 태반 위치를 직접 선택하세요.",
    ramziManual: "직접 선택:",
    ramziRight: "오른쪽",
    ramziLeft: "왼쪽",
    ramziUnknown: "모름 (자동 분석)",
    calTitle: "중국 황실 달력",
    calDesc: "산모의 생년월일(양력)을 선택하면 만나이가 자동 계산됩니다.",
    calBirthdate: "산모 생년월일 (양력)",
    calAgeDisplay: "자동 계산된 만나이",
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
    feedbackTitle: "실제 출산 후 알려주세요!",
    feedbackBoy: "실제로 남아였어요 🔵",
    feedbackGirl: "실제로 여아였어요 🌸",
    feedbackThanks: "소중한 피드백 감사합니다! 🙏",
    annoTitle: "AI 각도 분석 이미지",
    creator: "제작자",
    imagesUsed: "장 분석됨",
  },
  en: {
    tagline: "Predict your baby's gender from ultrasound",
    subtitle: "Nub Theory + Ramzi Method + Chinese Imperial Calendar",
    notice1: "Uploading ultrasound images from weeks 10–14 of pregnancy improves prediction accuracy.",
    notice2: "This service does not store your photos or personal data. All uploads are deleted immediately after analysis.",
    notice3: "Results are for fun and reference only and cannot replace medical judgment.",
    nubTitle: "Nub Theory",
    nubDesc: "Upload up to 3 ultrasound images and AI will automatically analyze the genital nub angle.",
    uploadHint: "Click or drag your image here",
    uploadSub: "JPG, PNG, WebP · Max 10MB",
    ramziTitle: "Ramzi Method",
    ramziDesc: "Upload up to 3 ultrasound images or manually select the placenta position.",
    ramziManual: "Select manually:",
    ramziRight: "Right",
    ramziLeft: "Left",
    ramziUnknown: "Unknown (auto-detect)",
    calTitle: "Chinese Imperial Calendar",
    calDesc: "Select your birthday (Gregorian) and the lunar conception month.",
    calBirthdate: "Mother's birthday (Gregorian)",
    calAgeDisplay: "Auto-calculated age",
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
    feedbackTitle: "Tell us after birth!",
    feedbackBoy: "It was a Boy! 🔵",
    feedbackGirl: "It was a Girl! 🌸",
    feedbackThanks: "Thank you for your feedback! 🙏",
    annoTitle: "AI Angle Analysis",
    creator: "Creator",
    imagesUsed: "image(s) analyzed",
  },
};

let lang = localStorage.getItem("nubscope_lang") || "ko";
let currentSessionId = null;

// Store selected File objects per slot
const slotFiles = { nub: [null, null, null], ramzi: [null, null, null] };

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

/* ── Age Auto-Calculation ── */
function calcKoreanAge(birthdateStr) {
  if (!birthdateStr) return null;
  const today = new Date();
  const birth = new Date(birthdateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/* ── Upload Slot Setup ── */
function setupSlot(slotEl) {
  const method = slotEl.dataset.method;
  const idx = parseInt(slotEl.dataset.idx);
  const input = slotEl.querySelector("input[type=file]");
  const placeholder = slotEl.querySelector(".slot-placeholder");
  const previewEl = slotEl.querySelector(".slot-preview");
  const previewImg = previewEl.querySelector("img");
  const removeBtn = previewEl.querySelector(".slot-remove");

  // Click to open file dialog
  placeholder.addEventListener("click", () => input.click());

  // Drag & drop
  slotEl.addEventListener("dragover", e => { e.preventDefault(); slotEl.classList.add("drag-over"); });
  slotEl.addEventListener("dragleave", () => slotEl.classList.remove("drag-over"));
  slotEl.addEventListener("drop", e => {
    e.preventDefault();
    slotEl.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setSlotFile(method, idx, file, previewImg, placeholder, previewEl);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) setSlotFile(method, idx, input.files[0], previewImg, placeholder, previewEl);
  });

  removeBtn.addEventListener("click", e => {
    e.stopPropagation();
    slotFiles[method][idx] = null;
    input.value = "";
    previewEl.style.display = "none";
    placeholder.style.display = "flex";
  });
}

function setSlotFile(method, idx, file, previewImg, placeholder, previewEl) {
  slotFiles[method][idx] = file;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    placeholder.style.display = "none";
    previewEl.style.display = "flex";
  };
  reader.readAsDataURL(file);
}

/* ── DOM Ready ── */
document.addEventListener("DOMContentLoaded", () => {
  setLang(lang);
  document.getElementById("btn-ko").addEventListener("click", () => setLang("ko"));
  document.getElementById("btn-en").addEventListener("click", () => setLang("en"));

  // Setup all upload slots
  document.querySelectorAll(".upload-slot").forEach(setupSlot);

  // Birthdate → auto age
  document.getElementById("cal-birthdate").addEventListener("change", function () {
    const age = calcKoreanAge(this.value);
    const ageInput = document.getElementById("cal-age");
    const ageHidden = document.getElementById("cal-age-hidden");
    if (age !== null && age >= 18 && age <= 45) {
      ageInput.value = age;
      ageHidden.value = age;
    } else {
      ageInput.value = "";
      ageHidden.value = "";
    }
  });

  // Ramzi manual select → disable/dim upload
  document.querySelectorAll('input[name="ramzi_manual"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const isAuto = radio.value === "auto";
      const multi = document.getElementById("ramzi-upload-multi");
      multi.style.opacity = isAuto ? "1" : "0.35";
      multi.style.pointerEvents = isAuto ? "all" : "none";
    });
  });

  document.getElementById("predict-form").addEventListener("submit", handleSubmit);
  document.getElementById("fb-boy").addEventListener("click", () => submitFeedback("boy"));
  document.getElementById("fb-girl").addEventListener("click", () => submitFeedback("girl"));
});

/* ── Form Submit ── */
async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("analyze-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  const fd = new FormData();
  currentSessionId = currentSessionId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
  fd.append("session_id", currentSessionId);

  // Nub images (indexed keys)
  slotFiles.nub.forEach((f, i) => { if (f) fd.append(`nub_image_${i}`, f); });

  // Ramzi
  const ramziManual = document.querySelector('input[name="ramzi_manual"]:checked')?.value || "auto";
  if (ramziManual !== "auto") {
    fd.append("ramzi_manual", ramziManual);
  } else {
    slotFiles.ramzi.forEach((f, i) => { if (f) fd.append(`ramzi_image_${i}`, f); });
  }

  // Calendar — use hidden field (auto-calculated age)
  const ageVal = document.getElementById("cal-age-hidden").value || document.getElementById("cal-age").value;
  const monthVal = document.getElementById("cal-month").value;
  if (ageVal) fd.append("calendar_age", ageVal);
  if (monthVal) fd.append("calendar_month", monthVal);

  try {
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    alert("분석에 실패했습니다. 다시 시도해 주세요.");
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

  // Badge
  const badge = document.getElementById("prediction-badge");
  badge.className = "prediction-badge " + probs.final;
  badge.textContent = probs.final === "boy" ? i18n[lang].boyResult : i18n[lang].girlResult;

  // Progress bars
  setTimeout(() => {
    document.getElementById("bar-boy").style.width = probs.boy + "%";
    document.getElementById("bar-girl").style.width = probs.girl + "%";
  }, 100);
  document.getElementById("pct-boy").textContent = probs.boy + "%";
  document.getElementById("pct-girl").textContent = probs.girl + "%";

  // Nub card
  setMethodCard("mc-nub", data.nub?.result, () => {
    const parts = [];
    if (data.nub?.angle) parts.push(`${data.nub.angle}°`);
    if (data.nub?.count > 1) parts.push(`${data.nub.count}${i18n[lang].imagesUsed}`);
    return parts.join(" · ");
  });

  // Ramzi card
  setMethodCard("mc-ramzi", data.ramzi?.result, () => {
    const pos = data.ramzi?.position;
    if (!pos) return "";
    return lang === "ko" ? (pos === "right" ? "오른쪽" : "왼쪽") : (pos === "right" ? "Right" : "Left");
  });

  // Calendar card
  setMethodCard("mc-cal", data.calendar?.result);

  // Annotated image
  if (data.nub?.image) {
    const wrap = document.getElementById("annotated-img-wrap");
    document.getElementById("annotated-img").src = "data:image/jpeg;base64," + data.nub.image;
    wrap.style.display = "block";
  }

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
