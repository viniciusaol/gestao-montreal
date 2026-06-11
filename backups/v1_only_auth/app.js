// ============================
// Montreal Tênis - Comissões Dashboard
// Direct REST API approach (no CDN dependency)
// ============================

const SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ';

// ---- Debug Logger ----
const debugLog = (msg, obj = '') => {
  const div = document.getElementById('debug-log');
  if (div) {
    const time = new Date().toLocaleTimeString();
    div.innerHTML += `<div style="margin-top:5px;border-bottom:1px solid rgba(241,244,224,0.05);padding-bottom:5px;">[${time}] ${msg} ${obj ? '<pre style="display:inline;color:#C05131;font-family:monospace;font-size:0.75rem;">' + JSON.stringify(obj, null, 2) + '</pre>' : ''}</div>`;
    div.scrollTop = div.scrollHeight;
  }
  console.log(msg, obj);
};

const debugError = (msg, err = '') => {
  const div = document.getElementById('debug-log');
  if (div) {
    const time = new Date().toLocaleTimeString();
    div.innerHTML += `<div style="margin-top:5px;color:#e63946;border-bottom:1px solid rgba(241,244,224,0.05);padding-bottom:5px;">[${time}] <strong>Erro:</strong> ${msg} ${err ? '<pre style="display:inline;color:#e63946;font-family:monospace;font-size:0.75rem;">' + (err.message || JSON.stringify(err)) + '</pre>' : ''}</div>`;
    div.scrollTop = div.scrollHeight;
  }
  console.error(msg, err);
};

// ---- Session Helpers ----
function getUserToken() {
  const sessionJson = localStorage.getItem('mt_session');
  if (!sessionJson) return null;
  try {
    const session = JSON.parse(sessionJson);
    if (session.expires_at && Date.now() > session.expires_at - 60000) {
      localStorage.removeItem('mt_session');
      return null;
    }
    return session.access_token || null;
  } catch (e) {
    return null;
  }
}

function checkSession() {
  const token = getUserToken();
  const overlay = document.getElementById('login-overlay');
  if (token) {
    if (overlay) {
      overlay.style.visibility = 'hidden';
      overlay.style.opacity = '0';
    }
    return true;
  } else {
    if (overlay) {
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.style.display = 'flex';
    }
    return false;
  }
}

// ---- Supabase REST helpers ----
async function supabaseSelect(table, queryParams = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
  debugLog(`[REST] GET ${url}`);
  const token = getUserToken() || SUPABASE_KEY;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST error ${res.status}: ${body}`);
  }
  return res.json();
}

async function supabaseInsert(table, row) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  debugLog(`[REST] POST ${url}`, row);
  const token = getUserToken() || SUPABASE_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST insert error ${res.status}: ${body}`);
  }
  return res.json();
}

async function supabaseDelete(table, filterKey, filterValue) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filterKey}=eq.${encodeURIComponent(filterValue)}`;
  debugLog(`[REST] DELETE ${url}`);
  const token = getUserToken() || SUPABASE_KEY;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST delete error ${res.status}: ${body}`);
  }
  return true;
}

// ---- DOM Elements ----
const selectProf = document.getElementById('select-prof');
const selectYear = document.getElementById('select-year');
const selectMonth = document.getElementById('select-month');
const inputCommission = document.getElementById('input-commission');
const commissionDisplay = document.getElementById('commission-display');
const btnPrint = document.getElementById('btn-print');

const valTotalPago = document.getElementById('val-total-pago');
const valComissaoGerada = document.getElementById('val-comissao-gerada');
const valRepassePago = document.getElementById('val-repasse-pago');
const valSaldoRestante = document.getElementById('val-saldo-restante');

const period1Pago = document.getElementById('period-1-pago');
const period1Comissao = document.getElementById('period-1-comissao');
const period2Pago = document.getElementById('period-2-pago');
const period2Comissao = document.getElementById('period-2-comissao');

const formPayout = document.getElementById('form-payout');
const payoutAmount = document.getElementById('payout-amount');
const payoutDate = document.getElementById('payout-date');
const payoutPeriod = document.getElementById('payout-period');
const payoutNotes = document.getElementById('payout-notes');

const payoutsHistoryRows = document.getElementById('payouts-history-rows');
const studentsTableRows = document.getElementById('students-table-rows');
const commColDisplays = document.querySelectorAll('.comm-col-display');

const printProfName = document.getElementById('print-prof-name');
const printPeriodName = document.getElementById('print-period-name');
const printCommissionRate = document.getElementById('print-commission-rate');
const printGenerationDate = document.getElementById('print-generation-date');

// ---- Auth DOM Elements ----
const loginOverlay = document.getElementById('login-overlay');
const formLogin = document.getElementById('form-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

let currentCommissionRate = 50;

// Set default date
payoutDate.value = new Date().toISOString().split('T')[0];

// Populate year select dynamically (2026 → current year + 1)
(function populateYears() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = 2026;
  const endYear = Math.max(currentYear + 1, startYear + 2);
  for (let y = startYear; y <= endYear; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    selectYear.appendChild(opt);
  }
  // Auto-select current month
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  selectMonth.value = currentMonth;
})();

// ---- Utilities ----
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateBR(dateString) {
  if (!dateString) return '--/--/----';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getEndOfMonth(dateString) {
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const lastDay = new Date(year, month, 0).getDate();
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
}

function getMonthNameBR(dateString) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const parts = dateString.split('-');
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${months[monthIdx]}/${parts[0]}`;
}

// ---- Load Dashboard ----
async function loadDashboard() {
  debugLog('loadDashboard() disparado.');
  if (!checkSession()) {
    debugLog('Sem sessão ativa. Abortando carregamento do dashboard.');
    return;
  }
  const professor = selectProf.value;
  const year = selectYear.value;
  const month = selectMonth.value;
  const monthStart = `${year}-${month}-01`;
  const monthEnd = getEndOfMonth(monthStart);
  const monthName = getMonthNameBR(monthStart);

  debugLog(`Parâmetros: Professor="${professor}", Mês="${monthName}" (${monthStart} até ${monthEnd})`);

  // Update headers
  document.getElementById('dashboard-subtitle').innerText = `Visualizando comissões para ${professor} em ${monthName}`;
  printProfName.innerText = professor;
  printPeriodName.innerText = monthName;
  printCommissionRate.innerText = `${currentCommissionRate}%`;
  printGenerationDate.innerText = new Date().toLocaleDateString('pt-BR');
  commColDisplays.forEach(el => el.innerText = `${currentCommissionRate}%`);

  try {
    // 1. Fetch classes from the view using direct REST
    const profEncoded = encodeURIComponent(professor);
    const classesParams = `select=*&booking_date=gte.${monthStart}&booking_date=lte.${monthEnd}&professor=eq.${profEncoded}`;
    debugLog('Buscando aulas via REST API...');
    const classesData = await supabaseSelect('vw_mt_comissoes_detalhadas', classesParams);
    debugLog(`Aulas carregadas: ${classesData.length} linhas.`);

    // 2. Fetch payouts
    const payoutsParams = `select=*&professor=eq.${profEncoded}&reference_period=eq.${monthStart}&order=payout_date.desc`;
    debugLog('Buscando repasses via REST API...');
    const payoutsData = await supabaseSelect('mt_pagamentos_professores', payoutsParams);
    debugLog(`Repasses carregados: ${payoutsData.length} linhas.`);

    // Process Metrics
    let totalPaidFaturamento = 0;
    let period1PagoVal = 0;
    let period2PagoVal = 0;
    const studentAgg = {};

    classesData.forEach(row => {
      if (row.is_paid && parseFloat(row.booking_value) > 0) {
        const val = parseFloat(row.booking_value);
        totalPaidFaturamento += val;

        if (row.pay_date) {
          const datePart = row.pay_date.split(' ')[0];
          const day = parseInt(datePart.split('-')[2], 10);
          if (day <= 20) {
            period1PagoVal += val;
          } else {
            period2PagoVal += val;
          }
        }

        const studentName = row.participant_name || 'Desconhecido';
        if (!studentAgg[studentName]) {
          studentAgg[studentName] = { name: studentName, classesCount: 0, totalBilled: 0 };
        }
        studentAgg[studentName].classesCount += 1;
        studentAgg[studentName].totalBilled += val;
      }
    });

    const commissionGeneratedVal = totalPaidFaturamento * (currentCommissionRate / 100);
    const period1ComissaoVal = period1PagoVal * (currentCommissionRate / 100);
    const period2ComissaoVal = period2PagoVal * (currentCommissionRate / 100);

    let totalRepassePagoVal = 0;
    payoutsData.forEach(p => {
      totalRepassePagoVal += parseFloat(p.amount);
    });

    const saldoRestanteVal = commissionGeneratedVal - totalRepassePagoVal;

    // Update screen cards
    valTotalPago.innerText = formatCurrency(totalPaidFaturamento);
    valComissaoGerada.innerText = formatCurrency(commissionGeneratedVal);
    valRepassePago.innerText = formatCurrency(totalRepassePagoVal);
    valSaldoRestante.innerText = formatCurrency(saldoRestanteVal);

    period1Pago.innerText = formatCurrency(period1PagoVal);
    period1Comissao.innerText = formatCurrency(period1ComissaoVal);
    period2Pago.innerText = formatCurrency(period2PagoVal);
    period2Comissao.innerText = formatCurrency(period2ComissaoVal);

    // Update print-only summary
    const ps = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    ps('print-val-total-pago', formatCurrency(totalPaidFaturamento));
    ps('print-val-comissao', formatCurrency(commissionGeneratedVal));
    ps('print-val-repasse', formatCurrency(totalRepassePagoVal));
    ps('print-val-saldo', formatCurrency(saldoRestanteVal));

    debugLog(`Totais calculados: Faturado=${formatCurrency(totalPaidFaturamento)}, Comissão=${formatCurrency(commissionGeneratedVal)}`);

    renderPayoutsHistory(payoutsData);
    renderStudentBreakdown(Object.values(studentAgg));

  } catch (err) {
    debugError('Erro ao buscar dados do Supabase', err);
    alert('Erro ao carregar os dados do dashboard. Verifique o console de diagnóstico no rodapé da página.');
  }
}

// ---- Render Payouts History ----
function renderPayoutsHistory(payouts) {
  if (payouts.length === 0) {
    payoutsHistoryRows.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum repasse registrado para este mês.</td></tr>`;
    return;
  }
  payoutsHistoryRows.innerHTML = payouts.map(p => {
    let periodName = 'Integral';
    if (p.period_type === 'ate_dia_20') periodName = '1º Período';
    if (p.period_type === 'apos_dia_20') periodName = '2º Período';
    return `
      <tr>
        <td>${formatDateBR(p.payout_date)}</td>
        <td><span class="period-badge ${p.period_type === 'ate_dia_20' ? '' : 'secondary'}">${periodName}</span></td>
        <td class="font-semibold">${formatCurrency(parseFloat(p.amount))}</td>
        <td>
          <button class="btn-danger-sm" onclick="deletePayout('${p.payout_id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- Render Student Table ----
function renderStudentBreakdown(students) {
  if (students.length === 0) {
    studentsTableRows.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhuma aula paga registrada neste período.</td></tr>`;
    return;
  }
  students.sort((a, b) => b.totalBilled - a.totalBilled);

  let totalClasses = 0;
  let totalBilled = 0;
  let totalCommission = 0;

  let rowsHtml = students.map(s => {
    const studentComm = s.totalBilled * (currentCommissionRate / 100);
    totalClasses += s.classesCount;
    totalBilled += s.totalBilled;
    totalCommission += studentComm;
    return `
      <tr>
        <td>${s.name}</td>
        <td class="text-center">${s.classesCount}</td>
        <td class="text-right">${formatCurrency(s.totalBilled)}</td>
        <td class="text-right text-saibro font-semibold">${formatCurrency(studentComm)}</td>
      </tr>
    `;
  }).join('');

  rowsHtml += `
    <tr style="border-top: 2px solid var(--color-creme-claro); font-weight: 800;">
      <td>TOTAL</td>
      <td class="text-center">${totalClasses}</td>
      <td class="text-right">${formatCurrency(totalBilled)}</td>
      <td class="text-right text-saibro">${formatCurrency(totalCommission)}</td>
    </tr>
  `;
  studentsTableRows.innerHTML = rowsHtml;
}

// ---- Payout Form Submit ----
formPayout.addEventListener('submit', async (e) => {
  e.preventDefault();
  const professor = selectProf.value;
  const year = selectYear.value;
  const month = selectMonth.value;
  const monthStart = `${year}-${month}-01`;
  const amount = parseFloat(payoutAmount.value);
  const date = payoutDate.value;
  const periodType = payoutPeriod.value;
  const notes = payoutNotes.value;

  if (isNaN(amount) || amount <= 0) {
    alert('Por favor, digite um valor de repasse válido.');
    return;
  }

  try {
    await supabaseInsert('mt_pagamentos_professores', {
      professor: professor,
      amount: amount,
      payout_date: date,
      reference_period: monthStart,
      period_type: periodType,
      notes: notes
    });
    payoutAmount.value = '';
    payoutNotes.value = '';
    payoutDate.value = new Date().toISOString().split('T')[0];
    payoutPeriod.value = 'ate_dia_20';
    await loadDashboard();
  } catch (err) {
    debugError('Erro ao registrar repasse', err);
    alert('Erro ao registrar o pagamento. Verifique o console de diagnóstico.');
  }
});

// ---- Delete Payout ----
window.deletePayout = async function(payoutId) {
  if (!confirm('Deseja realmente excluir este registro de pagamento?')) return;
  try {
    await supabaseDelete('mt_pagamentos_professores', 'payout_id', payoutId);
    await loadDashboard();
  } catch (err) {
    debugError('Erro ao excluir repasse', err);
    alert('Erro ao excluir o pagamento. Verifique o console de diagnóstico.');
  }
};

// ---- Commission Rate Slider ----
inputCommission.addEventListener('input', (e) => {
  currentCommissionRate = parseInt(e.target.value, 10);
  commissionDisplay.innerText = `${currentCommissionRate}%`;
  loadDashboard();
});

// ---- PDF Export ----
btnPrint.addEventListener('click', () => {
  const professor = selectProf.value;
  const oldTitle = document.title;
  document.title = `Montreal Tenis - Relatorio de Comissao - ${professor}`;
  window.print();
  document.title = oldTitle;
});

// ---- Auth Event Listeners ----
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    loginError.style.display = 'none';
    loginError.innerText = '';
    
    const submitBtn = formLogin.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Entrando...';

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || errData.error || 'Erro desconhecido ao autenticar.');
      }

      const sessionData = await response.json();
      localStorage.setItem('mt_session', JSON.stringify({
        access_token: sessionData.access_token,
        expires_at: Date.now() + (sessionData.expires_in * 1000),
        email: sessionData.user.email
      }));

      // Hide login screen
      loginOverlay.style.visibility = 'hidden';
      loginOverlay.style.opacity = '0';

      // Clear form
      loginEmail.value = '';
      loginPassword.value = '';

      // Load data
      await loadDashboard();
    } catch (err) {
      debugError('Erro de login', err);
      loginError.innerText = err.message || 'Erro ao autenticar. Verifique suas credenciais.';
      loginError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Entrar';
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('mt_session');
    loginOverlay.style.visibility = 'visible';
    loginOverlay.style.opacity = '1';
    loginOverlay.style.display = 'flex';
    
    // Clear data
    valTotalPago.innerText = 'R$ 0,00';
    valComissaoGerada.innerText = 'R$ 0,00';
    valRepassePago.innerText = 'R$ 0,00';
    valSaldoRestante.innerText = 'R$ 0,00';
    payoutsHistoryRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar o histórico.</td></tr>`;
    studentsTableRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar os alunos.</td></tr>`;
  });
}

// ---- Event Listeners ----
selectProf.addEventListener('change', loadDashboard);
selectYear.addEventListener('change', loadDashboard);
selectMonth.addEventListener('change', loadDashboard);

// ---- Initial Load ----
debugLog('App JS inicializado. Usando REST API direta com autenticação.');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDashboard);
} else {
  loadDashboard();
}
