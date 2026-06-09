/**
 * Aksi Sehat - Educational Web Application Logic
 * Kemah Sekolah Sehat - Direktorat SMK
 */

// Application State
const state = {
  role: 'guest', // guest | student | admin
  student: {
    name: '',
    class: '',
    startedAt: null,
    currentPage: 1,
    unlockedPages: [1], // list of pages student has unlocked
    scores: {}, // page1: score, page2: score, etc.
    completedQuizzes: {}, // page1: true/false
    submittedAt: null
  },
  submissions: [], // List of all submissions (for admin view)
  storageMode: 'local', // local | server
  apiBaseUrl: window.location.origin // Dynamic API url
};

// Admin Configuration
const ADMIN_PIN = 'adminpmr';

// DOM Elements
const sections = {
  login: document.getElementById('login-section'),
  learning: document.getElementById('learning-section'),
  quiz: document.getElementById('quiz-section'),
  finish: document.getElementById('finish-section'),
  admin: document.getElementById('admin-section')
};

const navUserInfo = document.getElementById('nav-user-info');
const navStudentName = document.getElementById('nav-student-name');
const navStudentClass = document.getElementById('nav-student-class');
const logoutBtn = document.getElementById('logout-btn');
const adminLoginNavBtn = document.getElementById('admin-login-nav-btn');

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  detectStorageMode();
  setupEventListeners();
  restoreSession();
});

// Detect Storage Mode (Check if server.js Express API is running)
async function detectStorageMode() {
  try {
    const res = await fetch(`${state.apiBaseUrl}/api/status`, { method: 'GET', signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      const data = await res.json();
      state.storageMode = 'server';
      document.getElementById('stat-storage-mode').innerText = 'Server (Database)';
      console.log('Backend server detected. Database storage mode activated.');
      loadSubmissionsFromServer();
    }
  } catch (err) {
    state.storageMode = 'local';
    document.getElementById('stat-storage-mode').innerText = 'Lokal (LocalStorage)';
    console.log('No backend server found. Local fallback mode activated.');
    loadSubmissionsFromLocalStorage();
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Student Login Form
  document.getElementById('student-login-form').addEventListener('submit', handleStudentLogin);

  // Bottom Navigation Buttons
  document.getElementById('prev-page-btn').addEventListener('click', () => changePage(state.student.currentPage - 1));
  document.getElementById('next-page-btn').addEventListener('click', () => changePage(state.student.currentPage + 1));

  // Restart Button on Finish Page
  document.getElementById('restart-learning-btn').addEventListener('click', restartLearning);

  // Submit Online Button on Finish Page
  document.getElementById('finish-submit-online-btn').addEventListener('click', submitFinalResults);

  // Logout Button
  logoutBtn.addEventListener('click', logout);

  // Admin Nav Trigger
  adminLoginNavBtn.addEventListener('click', openAdminPinModal);
  document.getElementById('admin-shortcut-btn').addEventListener('click', openAdminPinModal);

  // Admin Pin Modal Closing
  document.getElementById('close-admin-pin-modal-btn').addEventListener('click', closeAdminPinModal);
  document.getElementById('admin-pin-form').addEventListener('submit', handleAdminPinVerification);

  // Admin Search / Filter
  document.getElementById('admin-search-input').addEventListener('input', handleAdminSearch);

  // Admin Import Token Modal
  document.getElementById('admin-import-token-btn').addEventListener('click', openImportTokenModal);
  document.getElementById('close-import-token-modal-btn').addEventListener('click', closeImportTokenModal);
  document.getElementById('import-token-form').addEventListener('submit', handleTokenImport);

  // Admin Export CSV
  document.getElementById('admin-export-csv-btn').addEventListener('click', exportToCSV);

  // Admin Reset Data
  document.getElementById('admin-reset-btn').addEventListener('click', resetSubmissionsData);
}

// Restore Session if page is reloaded
function restoreSession() {
  const savedRole = localStorage.getItem('sekolah_sehat_role');
  if (savedRole === 'student') {
    const savedStudent = localStorage.getItem('sekolah_sehat_student');
    if (savedStudent) {
      state.role = 'student';
      state.student = JSON.parse(savedStudent);
      
      // Update Nav UI
      navStudentName.innerText = state.student.name;
      navStudentClass.innerText = state.student.class;
      navUserInfo.style.display = 'flex';
      logoutBtn.style.display = 'inline-flex';
      adminLoginNavBtn.style.display = 'none';

      // Check if student already finished
      if (state.student.currentPage > 5) {
        showSection('finish');
        renderFinishPage();
      } else {
        showSection('learning');
        changePage(state.student.currentPage);
      }
    }
  } else if (savedRole === 'admin') {
    state.role = 'admin';
    navUserInfo.style.display = 'none';
    logoutBtn.innerText = 'Keluar Admin';
    logoutBtn.style.display = 'inline-flex';
    adminLoginNavBtn.style.display = 'none';
    showSection('admin');
    refreshAdminDashboard();
  }
}

// Change Navigation Pages (SPA Routing)
function showSection(sectionId) {
  Object.keys(sections).forEach(key => {
    if (key === sectionId) {
      sections[key].classList.add('active');
    } else {
      sections[key].classList.remove('active');
    }
  });

  // Ensure window scrolls back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'success' : ''}`;
  
  const icon = type === 'success' ? '✅' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Student Login
function handleStudentLogin() {
  const nameInput = document.getElementById('student-name').value.trim();
  const classInput = document.getElementById('student-class').value.trim();

  if (!nameInput || !classInput) {
    showToast('Harap masukkan nama dan kelas dengan lengkap!', 'error');
    return;
  }

  // Create new student session
  state.role = 'student';
  state.student = {
    name: nameInput,
    class: classInput,
    startedAt: new Date().toISOString(),
    currentPage: 1,
    unlockedPages: [1],
    scores: {},
    completedQuizzes: {},
    submittedAt: null
  };

  // Persist session
  localStorage.setItem('sekolah_sehat_role', 'student');
  localStorage.setItem('sekolah_sehat_student', JSON.stringify(state.student));

  // Update Nav UI
  navStudentName.innerText = nameInput;
  navStudentClass.innerText = classInput;
  navUserInfo.style.display = 'flex';
  logoutBtn.style.display = 'inline-flex';
  adminLoginNavBtn.style.display = 'none';

  // Navigate to Halaman 1
  showToast(`Selamat datang, ${nameInput}! Selamat belajar.`, 'success');
  showSection('learning');
  changePage(1);
}

// Logout
function logout() {
  localStorage.removeItem('sekolah_sehat_role');
  localStorage.removeItem('sekolah_sehat_student');
  
  state.role = 'guest';
  state.student = {
    name: '',
    class: '',
    startedAt: null,
    currentPage: 1,
    unlockedPages: [1],
    scores: {},
    completedQuizzes: {},
    submittedAt: null
  };

  // Reset Nav UI
  navUserInfo.style.display = 'none';
  logoutBtn.style.display = 'none';
  logoutBtn.innerText = 'Keluar';
  adminLoginNavBtn.style.display = 'inline-flex';

  // Back to login
  showToast('Sesi ditutup.', 'info');
  showSection('login');
}

// Render Reading Material dynamically
function renderMaterial(pageNum) {
  const contentWrapper = document.getElementById('material-content-wrapper');
  const materialData = materials.find(m => m.page === pageNum);
  
  if (!materialData) return;

  let htmlContent = `
    <div class="material-title-section">
      <span class="material-badge">Halaman ${materialData.page} dari 5</span>
      <h2>${materialData.title}</h2>
    </div>
  `;

  // Render each section based on its structure
  materialData.sections.forEach(section => {
    htmlContent += `<div class="material-section">`;
    if (section.heading) {
      htmlContent += `<h3>${section.heading}</h3>`;
    }

    if (section.type === 'text') {
      section.paragraphs.forEach(p => {
        htmlContent += `<p>${p}</p>`;
      });
    } else if (section.type === 'list') {
      if (section.intro) htmlContent += `<p>${section.intro}</p>`;
      htmlContent += `<ul class="material-list">`;
      section.items.forEach(item => {
        htmlContent += `<li>${item}</li>`;
      });
      htmlContent += `</ul>`;
    } else if (section.type === 'tabs') {
      if (section.intro) htmlContent += `<p>${section.intro}</p>`;
      htmlContent += `
        <div class="tab-container">
          <div class="tab-headers">
      `;
      section.tabs.forEach((tab, index) => {
        htmlContent += `
          <button class="tab-btn ${index === 0 ? 'active' : ''}" onclick="switchTab(event, '${tab.tabName}')">
            ${tab.icon} ${tab.tabName}
          </button>
        `;
      });
      htmlContent += `</div><div class="tab-content">`;
      section.tabs.forEach((tab, index) => {
        htmlContent += `
          <div class="tab-pane ${index === 0 ? 'active' : ''}" id="tab-pane-${tab.tabName}">
            <ul class="material-list">
              ${tab.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      });
      htmlContent += `</div></div>`;
    } else if (section.type === 'grid') {
      htmlContent += `<div class="material-grid">`;
      section.cards.forEach(card => {
        htmlContent += `
          <div class="grid-card">
            <div class="grid-card-icon">${card.icon}</div>
            <div class="grid-card-title">${card.title}</div>
            <div class="grid-card-text">${card.text}</div>
          </div>
        `;
      });
      htmlContent += `</div>`;
    } else if (section.type === 'info-box') {
      htmlContent += `<div class="info-box">${section.text.replace(/\n/g, '<br>')}</div>`;
    } else if (section.type === 'highlight') {
      htmlContent += `<div class="highlight-box">`;
      section.paragraphs.forEach(p => {
        htmlContent += `<p style="font-weight: 500;">${p}</p>`;
      });
      htmlContent += `</div>`;
    } else if (section.type === 'split-list') {
      if (section.intro) htmlContent += `<p>${section.intro}</p>`;
      htmlContent += `<div class="split-list-container">`;
      section.groups.forEach(group => {
        const borderClass = group.color === 'green' ? 'border-green' : 'border-red';
        htmlContent += `
          <div class="split-list-card ${borderClass}">
            <div class="split-list-title">${group.name}</div>
            <ul class="split-list">
              ${group.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      });
      htmlContent += `</div>`;
    }

    htmlContent += `</div>`; // Close section
  });

  // Append Quiz Button card
  const isCompleted = state.student.completedQuizzes[`page${pageNum}`];
  htmlContent += `
    <div class="quiz-trigger-card" style="margin-top: 3rem; text-align: center; padding: 2rem; background: var(--light-red); border: 2px dashed var(--border-red); border-radius: var(--radius-lg);">
      <h4 style="margin-bottom: 0.5rem; font-size: 1.25rem;">📝 Uji Pemahaman Halaman ${pageNum}</h4>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem;">
        ${isCompleted 
          ? 'Kamu telah mengerjakan kuis halaman ini. Ingin mengulangnya untuk meningkatkan nilaimu?' 
          : 'Kamu harus menjawab pertanyaan untuk melaju ke halaman materi berikutnya.'}
      </p>
      <button class="btn btn-primary" onclick="startQuiz(${pageNum})">
        ${isCompleted ? 'Ulangi Kuis 🔄' : 'Kerjakan Kuis Halaman Ini ⚡'}
      </button>
    </div>
  `;

  contentWrapper.innerHTML = htmlContent;
}

// Switch Tabs in materials
window.switchTab = function(event, tabName) {
  const container = event.target.closest('.tab-container');
  
  // Toggle tab buttons
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.currentTarget.classList.add('active');

  // Toggle tab panes
  container.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  container.querySelector(`#tab-pane-${tabName}`).classList.add('active');
};

// Change Active Material Page
function changePage(pageNum) {
  if (pageNum < 1 || pageNum > 5) return;
  
  // Check locking system
  if (pageNum > 1) {
    const prevPageCompleted = state.student.completedQuizzes[`page${pageNum - 1}`];
    if (!prevPageCompleted && !state.student.unlockedPages.includes(pageNum)) {
      showToast(`Halaman ${pageNum} masih terkunci. Jawab kuis Halaman ${pageNum - 1} terlebih dahulu!`, 'error');
      return;
    }
  }

  // Update State
  state.student.currentPage = pageNum;
  if (!state.student.unlockedPages.includes(pageNum)) {
    state.student.unlockedPages.push(pageNum);
  }
  
  saveStudentSession();

  // Show learning screen
  showSection('learning');
  renderMaterial(pageNum);
  updateProgressBar();
  renderSidebarSteps();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render Sidebar Navigation Steps
function renderSidebarSteps() {
  const stepsList = document.getElementById('sidebar-steps-list');
  stepsList.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const isCurrent = state.student.currentPage === i;
    const isCompleted = state.student.completedQuizzes[`page${i}`];
    const isUnlocked = state.student.unlockedPages.includes(i);
    
    let itemClass = 'step-nav-item';
    let statusIcon = '🔒';

    if (isCurrent) {
      itemClass += ' active';
      statusIcon = '📖';
    } else if (isCompleted) {
      itemClass += ' completed';
      statusIcon = '✅';
    } else if (isUnlocked) {
      statusIcon = '🔓';
    } else {
      itemClass += ' locked';
    }

    const item = document.createElement('li');
    item.className = itemClass;
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="step-number">${i}</span>
        <span style="font-size: 0.85rem; font-weight: 500;">Halaman ${i}</span>
      </div>
      <span class="step-status-icon">${statusIcon}</span>
    `;

    // Add click handler only if unlocked
    if (isUnlocked) {
      item.addEventListener('click', () => changePage(i));
    } else {
      item.addEventListener('click', () => showToast(`Selesaikan kuis Halaman ${i-1} untuk membuka halaman ini!`, 'error'));
    }

    stepsList.appendChild(item);
  }
}

// Update UI Progress Bar
function updateProgressBar() {
  const bar = document.getElementById('progress-bar-indicator');
  
  // Calculate completed quizzes count
  let completedCount = 0;
  for (let i = 1; i <= 5; i++) {
    if (state.student.completedQuizzes[`page${i}`]) {
      completedCount++;
    }
  }

  const percentage = completedCount * 20;
  bar.style.width = `${percentage}%`;
  bar.innerText = `${percentage}%`;
}

// Save Student Progress
function saveStudentSession() {
  localStorage.setItem('sekolah_sehat_student', JSON.stringify(state.student));
}

// Start Quiz page view
function startQuiz(pageNum) {
  const quizQuestions = quizzes[`page${pageNum}`];
  if (!quizQuestions) return;

  // Render quiz questions UI
  document.getElementById('quiz-page-badge').innerText = `Kuis Halaman ${pageNum}`;
  const questionsWrapper = document.getElementById('quiz-questions-wrapper');
  questionsWrapper.innerHTML = '';

  // Retrieve previous student answers if any
  const previousAnswers = state.student.answers && state.student.answers[`page${pageNum}`] || {};

  quizQuestions.forEach((q, qIndex) => {
    const questionCard = document.createElement('div');
    questionCard.className = 'quiz-question-card';
    questionCard.dataset.questionId = q.id;

    let optionsHtml = '';
    Object.keys(q.options).forEach(optKey => {
      const isSelected = previousAnswers[q.id] === optKey;
      optionsHtml += `
        <button type="button" class="quiz-option-btn ${isSelected ? 'selected' : ''}" 
                onclick="selectQuizOption(this, ${pageNum}, ${q.id}, '${optKey}')">
          <span class="quiz-option-badge">${optKey}</span>
          <span>${q.options[optKey]}</span>
        </button>
      `;
    });

    questionCard.innerHTML = `
      <div class="quiz-question-text">
        <span>${qIndex + 1}.</span>
        <span>${q.text}</span>
      </div>
      <div class="quiz-options-list">
        ${optionsHtml}
      </div>
      <div class="quiz-feedback" id="feedback-${pageNum}-${q.id}"></div>
    `;

    questionsWrapper.appendChild(questionCard);
  });

  // Setup submit button page reference
  document.getElementById('submit-quiz-btn').onclick = () => submitQuiz(pageNum);

  showSection('quiz');
}

// Select an option in a quiz question
window.selectQuizOption = function(element, pageNum, questionId, optionKey) {
  // Check if student answers container exists in state
  if (!state.student.answers) {
    state.student.answers = {};
  }
  if (!state.student.answers[`page${pageNum}`]) {
    state.student.answers[`page${pageNum}`] = {};
  }

  // Save selected option
  state.student.answers[`page${pageNum}`][questionId] = optionKey;

  // Visual highlights toggling
  const optionsList = element.closest('.quiz-options-list');
  optionsList.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  element.classList.add('selected');
};

// Evaluate Quiz Answers
function submitQuiz(pageNum) {
  const quizQuestions = quizzes[`page${pageNum}`];
  const studentAnswers = state.student.answers && state.student.answers[`page${pageNum}`] || {};

  // Check if student answered all 5 questions
  const answeredCount = Object.keys(studentAnswers).length;
  if (answeredCount < 5) {
    showToast('Harap jawab semua 5 pertanyaan kuis sebelum mengirim!', 'error');
    return;
  }

  // Calculate score
  let score = 0;
  quizQuestions.forEach(q => {
    const answer = studentAnswers[q.id];
    const isCorrect = answer === q.answer;
    
    if (isCorrect) score++;

    // Display correct/incorrect highlights on choice buttons
    const questionCard = document.querySelector(`[data-question-id="${q.id}"]`);
    const feedbackDiv = document.getElementById(`feedback-${pageNum}-${q.id}`);
    
    // Disable click events on options once submitted
    questionCard.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.style.pointerEvents = 'none';
      const badgeText = btn.querySelector('.quiz-option-badge').innerText;
      
      if (badgeText === q.answer) {
        btn.style.borderColor = '#4CAF50';
        btn.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        btn.style.color = '#2E7D32';
      } else if (badgeText === answer && !isCorrect) {
        btn.style.borderColor = '#EF4444';
        btn.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        btn.style.color = '#B91C1C';
      }
    });

    // Display feedback description text
    if (isCorrect) {
      feedbackDiv.className = 'quiz-feedback correct';
      feedbackDiv.innerText = 'Jawaban Benar!';
    } else {
      feedbackDiv.className = 'quiz-feedback incorrect';
      feedbackDiv.innerText = `Jawaban salah. Kunci jawaban: ${q.answer}`;
    }
  });

  // Save score to student state
  state.student.scores[`page${pageNum}`] = score;
  state.student.completedQuizzes[`page${pageNum}`] = true;

  // Unlock next page if page < 5
  if (pageNum < 5) {
    const nextPg = pageNum + 1;
    if (!state.student.unlockedPages.includes(nextPg)) {
      state.student.unlockedPages.push(nextPg);
    }
  }

  saveStudentSession();
  updateProgressBar();

  // Play micro success animation/alert
  showToast(`Kuis Selesai! Skor Anda: ${score} / 5.`, 'success');

  // Change Submit button to a 'Continue' button to avoid infinite submission
  const submitBtn = document.getElementById('submit-quiz-btn');
  submitBtn.innerText = pageNum === 5 ? 'Lihat Hasil Akhir 🏆' : 'Lanjutkan ke Halaman Berikutnya ➡️';
  submitBtn.onclick = () => {
    // Restore button text
    submitBtn.innerText = 'Kirim Jawaban Kuis 📝';
    if (pageNum === 5) {
      completeActivity();
    } else {
      changePage(pageNum + 1);
    }
  };
}

// Complete all 5 pages and quizzes
function completeActivity() {
  state.student.submittedAt = new Date().toISOString();
  saveStudentSession();

  // Navigate to Finish Section
  showSection('finish');
  renderFinishPage();

  // Fire confetti
  startConfettiAnimation();
}

// Render Results on Finish Page
function renderFinishPage() {
  let totalScore = 0;
  const breakdownGrid = document.getElementById('scores-breakdown-grid');
  breakdownGrid.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const score = state.student.scores[`page${i}`] || 0;
    totalScore += score;

    const item = document.createElement('div');
    item.className = 'score-badge-item';
    item.innerHTML = `
      Hal ${i}
      <span class="score-badge-val">${score}/5</span>
    `;
    breakdownGrid.appendChild(item);
  }

  // Display Total Score
  document.getElementById('total-score-display').innerText = `${totalScore} / 25`;
  
  // Rating Description
  let ratingText = '';
  if (totalScore === 25) {
    ratingText = 'Sempurna! Kamu memahami materi dengan sangat baik! 🇮🇩';
  } else if (totalScore >= 20) {
    ratingText = 'Sangat Baik! Kerja bagus! 🌟';
  } else if (totalScore >= 15) {
    ratingText = 'Baik! Pelajari lagi beberapa materi untuk hasil maksimal. 👍';
  } else {
    ratingText = 'Cukup. Silakan ulangi membaca materi agar lebih paham. 📚';
  }
  document.getElementById('total-score-rating').innerText = ratingText;

  // Generate Offline Copy Token Code (Unicode Safe)
  const tokenData = {
    name: state.student.name,
    class: state.student.class,
    startedAt: state.student.startedAt,
    submittedAt: state.student.submittedAt,
    scores: state.student.scores,
    totalScore: totalScore
  };

  const tokenString = 'KSS-' + btoa(unescape(encodeURIComponent(JSON.stringify(tokenData))));
  document.getElementById('token-string').innerText = tokenString;
  document.getElementById('token-display-box').style.display = 'flex';

  // Toggle submission buttons based on mode
  const submitBtn = document.getElementById('finish-submit-online-btn');
  if (state.storageMode === 'server') {
    submitBtn.style.display = 'inline-flex';
    submitBtn.innerText = 'Kirim Hasil Akhir ke Server 📤';
  } else {
    submitBtn.style.display = 'none'; // Only token copying needed for offline fallback
  }
}

// Submit Final Results to Server Database
async function submitFinalResults() {
  const submitBtn = document.getElementById('finish-submit-online-btn');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Mengirim data...';

  let totalScore = 0;
  for (let i = 1; i <= 5; i++) {
    totalScore += (state.student.scores[`page${i}`] || 0);
  }

  const payload = {
    name: state.student.name,
    class: state.student.class,
    startedAt: state.student.startedAt,
    submittedAt: state.student.submittedAt,
    scores: state.student.scores,
    totalScore: totalScore
  };

  try {
    const res = await fetch(`${state.apiBaseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Hasil belajarmu telah berhasil disimpan di server!', 'success');
      submitBtn.innerText = 'Data Terkirim ✅';
    } else {
      throw new Error('Gagal mengirim ke server');
    }
  } catch (err) {
    console.error(err);
    showToast('Koneksi server gagal. Salin Token kode Anda untuk dilaporkan secara manual.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Kirim Hasil Akhir ke Server 📤';
  }
}

// Reset and Start over
function restartLearning() {
  state.student.currentPage = 1;
  state.student.unlockedPages = [1];
  state.student.scores = {};
  state.student.completedQuizzes = {};
  state.student.answers = {};
  state.student.submittedAt = null;
  state.student.startedAt = new Date().toISOString();

  saveStudentSession();
  updateProgressBar();
  showSection('learning');
  changePage(1);
}

// ----------------------------------------
// ADMIN SECTION LOGIC
// ----------------------------------------

function openAdminPinModal() {
  document.getElementById('admin-pin-modal').classList.add('active');
  document.getElementById('admin-pin-input').focus();
}

function closeAdminPinModal() {
  document.getElementById('admin-pin-modal').classList.remove('active');
  document.getElementById('admin-pin-input').value = '';
}

// Admin PIN login verification
function handleAdminPinVerification() {
  const inputPin = document.getElementById('admin-pin-input').value;

  if (inputPin === ADMIN_PIN) {
    state.role = 'admin';
    localStorage.setItem('sekolah_sehat_role', 'admin');
    
    // UI adjustment
    closeAdminPinModal();
    navUserInfo.style.display = 'none';
    logoutBtn.innerText = 'Keluar Admin';
    logoutBtn.style.display = 'inline-flex';
    adminLoginNavBtn.style.display = 'none';

    // Show Admin dashboard
    showSection('admin');
    showToast('Login Admin berhasil!', 'success');
    refreshAdminDashboard();
  } else {
    showToast('PIN Admin salah! Silakan coba lagi.', 'error');
    document.getElementById('admin-pin-input').value = '';
    document.getElementById('admin-pin-input').focus();
  }
}

// Load Submissions from Local Storage fallback
function loadSubmissionsFromLocalStorage() {
  const data = localStorage.getItem('sekolah_sehat_submissions');
  state.submissions = data ? JSON.parse(data) : [];
}

// Save Submissions locally
function saveSubmissionsToLocalStorage() {
  localStorage.setItem('sekolah_sehat_submissions', JSON.stringify(state.submissions));
}

// Fetch Submissions from Backend Server
async function loadSubmissionsFromServer() {
  try {
    const res = await fetch(`${state.apiBaseUrl}/api/submissions`);
    if (res.ok) {
      state.submissions = await res.json();
      if (state.role === 'admin') {
        refreshAdminDashboard();
      }
    }
  } catch (err) {
    console.error('Failed to load server submissions:', err);
  }
}

// Render Table and Stats in Admin Panel
function refreshAdminDashboard() {
  // Stat Card 1: Students count
  document.getElementById('stat-total-students').innerText = state.submissions.length;

  // Stat Card 2: Average Score
  let avg = 0;
  if (state.submissions.length > 0) {
    const totalSum = state.submissions.reduce((acc, curr) => acc + curr.totalScore, 0);
    avg = (totalSum / state.submissions.length).toFixed(1);
  }
  document.getElementById('stat-average-score').innerText = avg;

  // Render submissions list rows
  renderSubmissionsTable(state.submissions);
}

// Render Submissions Table Rows
function renderSubmissionsTable(dataList) {
  const tbody = document.getElementById('admin-submissions-tbody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-table">
        <td colspan="7" style="text-align: center;">Belum ada data pengerjaan siswa.</td>
      </tr>
    `;
    return;
  }

  // Date Formatting Helper
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${dayName}, ${dateNum} ${monthName} (${hours}:${minutes})`;
  };

  dataList.forEach((sub, index) => {
    const row = document.createElement('tr');
    
    // Scores detail per page
    const s1 = sub.scores && sub.scores.page1 !== undefined ? sub.scores.page1 : '-';
    const s2 = sub.scores && sub.scores.page2 !== undefined ? sub.scores.page2 : '-';
    const s3 = sub.scores && sub.scores.page3 !== undefined ? sub.scores.page3 : '-';
    const s4 = sub.scores && sub.scores.page4 !== undefined ? sub.scores.page4 : '-';
    const s5 = sub.scores && sub.scores.page5 !== undefined ? sub.scores.page5 : '-';

    row.innerHTML = `
      <td>${index + 1}</td>
      <td style="font-weight: 700;">${sub.name}</td>
      <td><span class="material-badge">${sub.class}</span></td>
      <td><span class="timestamp-text">${formatDate(sub.startedAt)}</span></td>
      <td><span class="timestamp-text">${formatDate(sub.submittedAt)}</span></td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        H1: <b>${s1}</b> | H2: <b>${s2}</b> | H3: <b>${s3}</b> | H4: <b>${s4}</b> | H5: <b>${s5}</b>
      </td>
      <td><span class="score-badge">${sub.totalScore} / 25</span></td>
    `;
    tbody.appendChild(row);
  });
}

// Filter and Search submissions
function handleAdminSearch() {
  const query = document.getElementById('admin-search-input').value.toLowerCase().trim();
  
  if (!query) {
    renderSubmissionsTable(state.submissions);
    return;
  }

  const filtered = state.submissions.filter(sub => {
    const nameMatch = sub.name.toLowerCase().includes(query);
    const classMatch = sub.class.toLowerCase().includes(query);
    return nameMatch || classMatch;
  });

  renderSubmissionsTable(filtered);
}

// Admin Token Importer
function openImportTokenModal() {
  document.getElementById('import-token-modal').classList.add('active');
  document.getElementById('token-input-textarea').focus();
}

function closeImportTokenModal() {
  document.getElementById('import-token-modal').classList.remove('active');
  document.getElementById('token-input-textarea').value = '';
}

// Process student token import
async function handleTokenImport() {
  const tokenInput = document.getElementById('token-input-textarea').value.trim();

  if (!tokenInput) {
    showToast('Token tidak boleh kosong!', 'error');
    return;
  }

  if (!tokenInput.startsWith('KSS-')) {
    showToast('Format token tidak valid! Token harus diawali dengan "KSS-".', 'error');
    return;
  }

  try {
    const base64Data = tokenInput.replace('KSS-', '');
    const decodedString = decodeURIComponent(escape(atob(base64Data)));
    const submissionData = JSON.parse(decodedString);

    // Validate structure
    if (!submissionData.name || !submissionData.class || submissionData.totalScore === undefined) {
      throw new Error('Invalid structure');
    }

    // Save submission
    if (state.storageMode === 'server') {
      const res = await fetch(`${state.apiBaseUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });
      if (res.ok) {
        showToast(`Token data ${submissionData.name} berhasil diimpor ke server database!`, 'success');
        loadSubmissionsFromServer();
      } else {
        throw new Error('Gagal push ke server');
      }
    } else {
      // Local Storage Mode
      // Check duplicate
      const duplicateIndex = state.submissions.findIndex(
        sub => sub.name.toLowerCase() === submissionData.name.toLowerCase() && 
               sub.class.toLowerCase() === submissionData.class.toLowerCase()
      );

      if (duplicateIndex > -1) {
        state.submissions[duplicateIndex] = submissionData; // Overwrite
      } else {
        state.submissions.push(submissionData);
      }

      saveSubmissionsToLocalStorage();
      showToast(`Token data ${submissionData.name} berhasil diimpor!`, 'success');
      refreshAdminDashboard();
    }

    closeImportTokenModal();
  } catch (err) {
    console.error(err);
    showToast('Token rusak atau tidak valid. Harap periksa kembali token yang disalin.', 'error');
  }
}

// Export Submissions to CSV format
function exportToCSV() {
  if (state.submissions.length === 0) {
    showToast('Belum ada data untuk diekspor!', 'error');
    return;
  }

  // Create Header CSV
  let csvContent = 'No,Nama Siswa,Kelas,Waktu Mulai,Waktu Selesai,Skor Halaman 1,Skor Halaman 2,Skor Halaman 3,Skor Halaman 4,Skor Halaman 5,Total Skor\n';

  state.submissions.forEach((sub, index) => {
    const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    
    const name = escapeCsv(sub.name);
    const studentClass = escapeCsv(sub.class);
    const start = sub.startedAt || '';
    const end = sub.submittedAt || '';
    
    const s1 = sub.scores && sub.scores.page1 !== undefined ? sub.scores.page1 : 0;
    const s2 = sub.scores && sub.scores.page2 !== undefined ? sub.scores.page2 : 0;
    const s3 = sub.scores && sub.scores.page3 !== undefined ? sub.scores.page3 : 0;
    const s4 = sub.scores && sub.scores.page4 !== undefined ? sub.scores.page4 : 0;
    const s5 = sub.scores && sub.scores.page5 !== undefined ? sub.scores.page5 : 0;
    
    csvContent += `${index + 1},${name},${studentClass},${start},${end},${s1},${s2},${s3},${s4},${s5},${sub.totalScore}\n`;
  });

  // Create Downloadable blob link
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `rekap_aksi_sehat_smk_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Data CSV berhasil diunduh!', 'success');
}

// Clear Database Reset
async function resetSubmissionsData() {
  const confirmReset = confirm('Apakah Anda yakin ingin menghapus seluruh rekap pengisian siswa? Tindakan ini permanen dan tidak dapat dibatalkan.');
  
  if (!confirmReset) return;

  if (state.storageMode === 'server') {
    try {
      const res = await fetch(`${state.apiBaseUrl}/api/reset`, { method: 'POST' });
      if (res.ok) {
        showToast('Seluruh data di database server berhasil dibersihkan!', 'success');
        loadSubmissionsFromServer();
      } else {
        throw new Error('Reset failed');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal mereset data server.', 'error');
    }
  } else {
    // Local storage
    state.submissions = [];
    saveSubmissionsToLocalStorage();
    showToast('Seluruh data lokal berhasil dibersihkan!', 'success');
    refreshAdminDashboard();
  }
}

// ----------------------------------------
// HTML5 CANVAS CONFETTI CELEBRATION
// ----------------------------------------

function startConfettiAnimation() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    '#D32F2F', // Primary Red
    '#E53935', // Accent Red
    '#8B0000', // Dark Red
    '#FFFFFF', // White
    '#FFCDD2'  // Soft pink-red
  ];

  const particles = [];
  const particleCount = 150;

  class ConfettiParticle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height - canvas.height;
      this.size = Math.random() * 8 + 5;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.speed = Math.random() * 4 + 2;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = Math.random() * 4 - 2;
      this.wind = Math.random() * 2 - 1;
    }

    update() {
      this.y += this.speed;
      this.x += this.wind;
      this.rotation += this.rotationSpeed;

      // Reset when particle falls off screen
      if (this.y > canvas.height) {
        this.y = -20;
        this.x = Math.random() * canvas.width;
        this.speed = Math.random() * 4 + 2;
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillStyle = this.color;
      
      // Draw rectangular confetti piece
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      
      ctx.restore();
    }
  }

  // Initialize particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(new ConfettiParticle());
  }

  let animationFrameId;
  let animationTime = 0;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    animationTime++;
    
    // Animate for 6 seconds (assuming 60fps, roughly 360 frames)
    if (animationTime < 360) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrameId);
    }
  }

  // Handle window resizing
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  animate();
}
