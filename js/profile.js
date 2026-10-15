/* Profile, nutrition targets and the profile sheet. */

/* Profile */
const ACTIVITY_LEVELS = {
  desk: { label: 'Desk job + training', factor: 1.45 },
  feet: { label: 'On my feet a lot + training', factor: 1.6 },
  physical: { label: 'Physical job + training', factor: 1.75 }
};

const GOAL_TYPES = {
  recomp: { label: 'Body recomposition', calories: 0.93, proteinPerKg: 2.0 },
  lose: { label: 'Fat loss', calories: 0.8, proteinPerKg: 2.2 },
  gain: { label: 'Muscle gain', calories: 1.1, proteinPerKg: 1.8 }
};

function getProfile() {
  const profile = readJSON(PROFILE_KEY, null);
  return profile && typeof profile === 'object' ? profile : null;
}

function getGoalKg() {
  const profile = getProfile();
  return profile && profile.goalKg > 0 ? profile.goalKg : null;
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

// Age from the birth date (Profile) or, when only an age was given at setup, that age
function profileAge(profile) {
  return (profile && (calcAge(profile.birthDate) || profile.age)) || null;
}

function currentWeightKg(profile) {
  const bw = getBodyweight();
  return bw.length ? bw[bw.length - 1].kg : (profile && profile.weightKg) || null;
}

// Mifflin-St Jeor resting burn × activity, adjusted for the goal. Estimates, not prescriptions.
function nutritionTargets(profile) {
  const weight = currentWeightKg(profile);
  const age = profileAge(profile);
  if (!profile.sex || !age || !profile.heightCm || !weight) return null;
  const bmr = 10 * weight + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  const maintenance = bmr * (ACTIVITY_LEVELS[profile.activity] || ACTIVITY_LEVELS.desk).factor;
  const goal = GOAL_TYPES[profile.goalType] || GOAL_TYPES.recomp;
  const round = (n, step) => Math.round(n / step) * step;
  const calories = round(maintenance * goal.calories, 50);
  const protein = round(weight * goal.proteinPerKg, 5);
  const fat = round(weight * 0.9, 5);
  const carbs = Math.max(0, round((calories - protein * 4 - fat * 9) / 4, 5));
  return { maintenance: round(maintenance, 50), calories, protein, fat, carbs };
}

function fillProfileForm() {
  const p = getProfile() || {};
  document.getElementById('pf-name').value = p.name || '';
  document.getElementById('pf-sex').value = p.sex || '';
  document.getElementById('pf-birth').value = p.birthDate || '';
  document.getElementById('pf-height').value = p.heightCm || '';
  document.getElementById('pf-weight').value = p.weightKg || '';
  document.getElementById('pf-goal').value = p.goalKg || '';
  document.getElementById('pf-activity').value = p.activity || 'desk';
  document.getElementById('pf-goaltype').value = p.goalType || 'recomp';
}

function saveProfileForm(silent = false) {
  const num = id => {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? null : Math.round(v * 10) / 10;
  };
  const profile = {
    name: document.getElementById('pf-name').value.trim(),
    sex: document.getElementById('pf-sex').value,
    birthDate: document.getElementById('pf-birth').value,
    heightCm: num('pf-height'),
    weightKg: num('pf-weight'),
    goalKg: num('pf-goal'),
    activity: document.getElementById('pf-activity').value,
    goalType: document.getElementById('pf-goaltype').value
  };
  if (profile.heightCm && (profile.heightCm < 100 || profile.heightCm > 250)) {
    fieldError(document.getElementById('pf-height'), 'Height should be 100–250 cm.');
    return false;
  }
  for (const [field, id] of [['weightKg', 'pf-weight'], ['goalKg', 'pf-goal']]) {
    if (profile[field] && (profile[field] < 25 || profile[field] > 300)) {
      fieldError(document.getElementById(id), 'Weight should be 25–300 kg.');
      return false;
    }
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  updateHeader();
  updateStats();
  renderProfileTargets();
  if (!document.getElementById('view-settings').hidden) renderSettings();
  if (!silent) {
    haptic('success');
    showToast('Profile saved');
  }
  return true;
}

function renderProfileTargets() {
  const profile = getProfile();
  const box = document.getElementById('pf-targets');
  const t = profile && nutritionTargets(profile);
  if (!t) {
    box.innerHTML = `<div class="section-meta">Add sex, birth date, height and weight to see your daily calorie and protein targets.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="targets-grid">
      <div class="target-tile"><div class="target-val">${t.calories.toLocaleString('en-US')}</div><div class="target-lbl">kcal</div></div>
      <div class="target-tile"><div class="target-val">${t.protein} g</div><div class="target-lbl">Protein</div></div>
      <div class="target-tile"><div class="target-val">${t.fat} g</div><div class="target-lbl">Fat</div></div>
      <div class="target-tile"><div class="target-val">${t.carbs} g</div><div class="target-lbl">Carbs</div></div>
    </div>
    <div class="section-meta">Daily targets for ${(GOAL_TYPES[profile.goalType] || GOAL_TYPES.recomp).label.toLowerCase()}. Estimated maintenance: ${t.maintenance.toLocaleString('en-US')} kcal. Uses your latest logged bodyweight.</div>`;
}

/* Profile sheet: every change saves on its own */
function openProfileSheet() {
  fillProfileForm();
  renderProfileTargets();
  document.getElementById('profile-saved').hidden = true;
  openSheet('profile-sheet');
}

let savedTickTimer = null;

document.querySelectorAll('#profile-sheet input, #profile-sheet select').forEach(el => {
  el.addEventListener('change', () => {
    if (!saveProfileForm(true)) return;
    const tick = document.getElementById('profile-saved');
    tick.hidden = false;
    tick.classList.remove('pop');
    void tick.offsetWidth;
    tick.classList.add('pop');
    clearTimeout(savedTickTimer);
    savedTickTimer = setTimeout(() => { tick.hidden = true; }, 1800);
  });
});
