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
  const appWrapper = document.querySelector('.app-wrapper');
  if (token) {
    if (overlay) {
      overlay.style.visibility = 'hidden';
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
    if (appWrapper) {
      appWrapper.style.display = 'block';
    }
    return true;
  } else {
    if (overlay) {
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.style.display = 'flex';
    }
    if (appWrapper) {
      appWrapper.style.display = 'none';
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

// ---- Tab DOM Elements ----
const tabPaid = document.getElementById('tab-paid');
const tabPending = document.getElementById('tab-pending');

let currentCommissionRate = 47;
let currentTab = 'paid';
let studentsPaid = [];
let studentsPending = [];
let metricsPaid = { faturamento: 0, comissao: 0, repasse: 0, saldo: 0, period1Pago: 0, period1Comissao: 0, period2Pago: 0, period2Comissao: 0 };
let metricsPending = { faturamento: 0, comissao: 0, repasse: 0, saldo: 0, period1Pago: 0, period1Comissao: 0, period2Pago: 0, period2Comissao: 0 };
let currentClassesData = [];
let currentPayoutsData = [];
let cachedFinancialData = null;

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

async function populateProfessors() {
  try {
    debugLog('Carregando lista de professores dinamicamente...');
    const prevSelected = selectProf.value;

    const data = await supabaseSelect('vw_mt_comissoes_detalhadas', 'select=professor');
    const uniqueProfs = Array.from(new Set(data.map(d => d.professor).filter(Boolean))).sort();

    if (uniqueProfs.length === 0) {
      throw new Error('Nenhum professor retornado pelo banco.');
    }

    selectProf.innerHTML = '';

    uniqueProfs.forEach(prof => {
      if (prof !== 'Sem professor') {
        const opt = document.createElement('option');
        opt.value = prof;
        opt.textContent = prof;
        selectProf.appendChild(opt);
      }
    });

    if (uniqueProfs.includes('Sem professor')) {
      const opt = document.createElement('option');
      opt.value = 'Sem professor';
      opt.textContent = 'Sem Professor';
      selectProf.appendChild(opt);
    }

    if (prevSelected && uniqueProfs.includes(prevSelected)) {
      selectProf.value = prevSelected;
    } else {
      selectProf.selectedIndex = 0;
    }

    debugLog(`Dropdown de professores populado com: ${uniqueProfs.join(', ')}. Selecionado: ${selectProf.value}`);
  } catch (err) {
    debugError('Erro ao carregar lista de professores do Supabase', err);
    selectProf.innerHTML = `
      <option value="Rodrigo Assunção">Rodrigo Assunção</option>
      <option value="João Assunção">João Assunção</option>
      <option value="Leandro Bonete">Leandro Bonete</option>
      <option value="Tatiana Araújo">Tatiana Araújo</option>
      <option value="Sem professor">Sem Professor</option>
    `;
  }
}

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

// ---- Pricing Table and Estimation Engine ----
const PRICING = {
  ADULTO: { GRUPO: 335, TRIO: 395, DUPLA: 430, INDIVIDUAL: 720 },
  KIDS: { BABY: 255, NORMAL: 255, INDIVIDUAL: 450 }
};

function getWeekdayOccurrencesInMonth(year, monthStr, dayOfWeek) {
  const y = parseInt(year, 10);
  const m = parseInt(monthStr, 10) - 1;
  let count = 0;
  const date = new Date(y, m, 1);
  while (date.getMonth() === m) {
    if (date.getDay() === dayOfWeek) {
      count++;
    }
    date.setDate(date.getDate() + 1);
  }
  return count;
}

function getBasePriceForBooking(booking) {
  const desc = (booking.description || '').toUpperCase();
  const type = booking.booking_type || '';
  
  // Detect capacity from pattern "(X / Y)" or "(X/Y)"
  let capacity = 4; // Default to Group
  const capMatch = desc.match(/\(\s*\d+\s*\/\s*(\d+)\s*\)/);
  if (capMatch) {
    capacity = parseInt(capMatch[1], 10);
  } else if (type === 'clase_suelta') {
    capacity = 1;
  }

  // Detect Kids / Baby
  const isKids = desc.includes('KIDS') || desc.includes('BABY');
  if (isKids) {
    if (capacity === 1 || desc.includes('INDIVIDUAL')) {
      return { price: PRICING.KIDS.INDIVIDUAL, isMonthly: true, category: 'Kids Individual' };
    }
    if (desc.includes('BABY')) {
      return { price: PRICING.KIDS.BABY, isMonthly: true, category: 'Baby Tennis' };
    }
    return { price: PRICING.KIDS.NORMAL, isMonthly: true, category: 'Kids Normal' };
  }

  // Adult
  if (type === 'clase_suelta') {
    return { price: 120, isMonthly: false, category: 'Adulto Avulso' };
  }
  
  if (capacity === 1) {
    return { price: PRICING.ADULTO.INDIVIDUAL, isMonthly: true, category: 'Adulto Individual' };
  }
  if (capacity === 2) {
    return { price: PRICING.ADULTO.DUPLA, isMonthly: true, category: 'Adulto Dupla' };
  }
  if (capacity === 3) {
    return { price: PRICING.ADULTO.TRIO, isMonthly: true, category: 'Adulto Trio' };
  }
  return { price: PRICING.ADULTO.GRUPO, isMonthly: true, category: 'Adulto Grupo' };
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

    // Store in global cache for local recalculation
    currentClassesData = classesData;
    currentPayoutsData = payoutsData;

    // Perform calculations and rendering locally
    calculateAndRenderDashboardData();

  } catch (err) {
    debugError('Erro ao buscar dados do Supabase', err);
    alert('Erro ao carregar os dados do dashboard. Verifique o console de diagnóstico no rodapé da página.');
  }
}

// ---- Calculate and Render Dashboard Data Locally (No network requests) ----
function calculateAndRenderDashboardData() {
  const classesData = currentClassesData;
  const payoutsData = currentPayoutsData;
  const year = selectYear.value;
  const month = selectMonth.value;

  // Group bookings by student for pending calculations
  const pendingBookingsByStudent = {};
  const paidAgg = {};
  let totalPaidFaturamento = 0;
  let period1PagoVal = 0;
  let period2PagoVal = 0;

  classesData.forEach(row => {
    const studentName = row.participant_name || 'Desconhecido';
    if (row.is_paid) {
      const val = parseFloat(row.booking_value) || 0;
      if (val > 0) {
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
        if (!paidAgg[studentName]) {
          paidAgg[studentName] = { name: studentName, classesCount: 0, totalBilled: 0 };
        }
        paidAgg[studentName].classesCount += 1;
        paidAgg[studentName].totalBilled += val;
      }
    } else {
      // Unpaid / Pending
      if (!pendingBookingsByStudent[studentName]) {
        pendingBookingsByStudent[studentName] = [];
      }
      pendingBookingsByStudent[studentName].push(row);
    }
  });

  studentsPaid = Object.values(paidAgg);

  // Now calculate estimations for pending students
  let totalPendingFaturamento = 0;
  let period1PendingVal = 0;
  let period2PendingVal = 0;
  studentsPending = [];

  Object.keys(pendingBookingsByStudent).forEach(studentName => {
    const bookings = pendingBookingsByStudent[studentName];
    
    // Group bookings by unique weekly slot to identify F (frequency)
    const slots = {};
    bookings.forEach(b => {
      const dateObj = new Date(b.booking_date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const startTime = b.start_time || '00:00';
      const pricingInfo = getBasePriceForBooking(b);
      
      const slotKey = `${dayOfWeek}_${startTime}_${pricingInfo.category}`;
      if (!slots[slotKey]) {
        slots[slotKey] = {
          dayOfWeek,
          startTime,
          pricingInfo,
          bookings: []
        };
      }
      slots[slotKey].bookings.push(b);
    });

    const uniqueSlotsList = Object.values(slots);
    const frequency = uniqueSlotsList.length;

    // Frequency discount rate
    let freqDiscountRate = 0;
    if (frequency === 2) freqDiscountRate = 0.05;
    else if (frequency >= 3) freqDiscountRate = 0.07;

    let studentTotalBilled = 0;

    uniqueSlotsList.forEach(slot => {
      const pricing = slot.pricingInfo;
      const nBookings = slot.bookings.length;

      // Check if slot is off-peak (weekday between 10:00 and 15:00)
      const isOffPeak = slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5 && 
                        (parseInt(slot.startTime.split(':')[0], 10) >= 10 && parseInt(slot.startTime.split(':')[0], 10) <= 15);

      let slotProRataValue = 0;
      if (pricing.isMonthly) {
        const nTotal = getWeekdayOccurrencesInMonth(year, month, slot.dayOfWeek);
        slotProRataValue = (nBookings / nTotal) * pricing.price;
      } else {
        slotProRataValue = nBookings * pricing.price;
      }

      // Apply discounts
      let slotFinalValue = 0;
      if (isOffPeak) {
        slotFinalValue = slotProRataValue * 0.88; // 12% discount
      } else {
        slotFinalValue = slotProRataValue * (1 - freqDiscountRate);
      }

      // Distribute to individual bookings for period distribution
      const perBookingValue = slotFinalValue / nBookings;
      slot.bookings.forEach(b => {
        b.estimated_value = perBookingValue;
        const day = parseInt(b.booking_date.split('-')[2], 10);
        if (day <= 20) {
          period1PendingVal += perBookingValue;
        } else {
          period2PendingVal += perBookingValue;
        }
      });

      studentTotalBilled += slotFinalValue;
    });

    totalPendingFaturamento += studentTotalBilled;
    studentsPending.push({
      name: studentName,
      classesCount: bookings.length,
      totalBilled: studentTotalBilled
    });
  });

  const commissionGeneratedVal = totalPaidFaturamento * (currentCommissionRate / 100);
  const period1ComissaoVal = period1PagoVal * (currentCommissionRate / 100);
  const period2ComissaoVal = period2PagoVal * (currentCommissionRate / 100);

  const pendingCommissionVal = totalPendingFaturamento * (currentCommissionRate / 100);
  const period1PendingComissaoVal = period1PendingVal * (currentCommissionRate / 100);
  const period2PendingComissaoVal = period2PendingVal * (currentCommissionRate / 100);

  let totalRepassePagoVal = 0;
  payoutsData.forEach(p => {
    totalRepassePagoVal += parseFloat(p.amount);
  });

  // Populate global metrics objects
  metricsPaid = {
    faturamento: totalPaidFaturamento,
    comissao: commissionGeneratedVal,
    repasse: totalRepassePagoVal,
    saldo: commissionGeneratedVal - totalRepassePagoVal,
    period1Pago: period1PagoVal,
    period1Comissao: period1ComissaoVal,
    period2Pago: period2PagoVal,
    period2Comissao: period2ComissaoVal
  };

  metricsPending = {
    faturamento: totalPendingFaturamento,
    comissao: pendingCommissionVal,
    repasse: totalRepassePagoVal,
    saldo: pendingCommissionVal - totalRepassePagoVal,
    period1Pago: period1PendingVal,
    period1Comissao: period1PendingComissaoVal,
    period2Pago: period2PendingVal,
    period2Comissao: period2PendingComissaoVal
  };

  renderPayoutsHistory(payoutsData);
  renderDashboardUI();
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

// ---- Render Dashboard UI Components ----
function renderDashboardUI() {
  const isPaid = currentTab === 'paid';
  const metrics = isPaid ? metricsPaid : metricsPending;

  // 1. Screen titles of metric cards (Always Paid Titles)
  const lblTotalPago = document.getElementById('lbl-total-pago');
  const lblComissaoGerada = document.getElementById('lbl-comissao-gerada');
  const lblSaldoRestante = document.getElementById('lbl-saldo-restante');

  if (lblTotalPago) lblTotalPago.innerText = 'Valor Faturado (Total Pago)';
  if (lblComissaoGerada) lblComissaoGerada.innerText = 'Comissão Gerada';
  if (lblSaldoRestante) lblSaldoRestante.innerText = 'Saldo Restante';

  // 2. Update screen metric values (Always Paid Values)
  valTotalPago.innerText = formatCurrency(metricsPaid.faturamento);
  valComissaoGerada.innerText = formatCurrency(metricsPaid.comissao);
  valRepassePago.innerText = formatCurrency(metricsPaid.repasse);
  valSaldoRestante.innerText = formatCurrency(metricsPaid.saldo);

  // 3. Update screen period breakdown values (Always Paid Values)
  period1Pago.innerText = formatCurrency(metricsPaid.period1Pago);
  period1Comissao.innerText = formatCurrency(metricsPaid.period1Comissao);
  period2Pago.innerText = formatCurrency(metricsPaid.period2Pago);
  period2Comissao.innerText = formatCurrency(metricsPaid.period2Comissao);

  // 4. Update print-only summary labels and values based on the active tab (Paid or Pending)
  const lblPrintTotalPago = document.getElementById('lbl-print-total-pago');
  const lblPrintComissao = document.getElementById('lbl-print-comissao');
  const lblPrintSaldo = document.getElementById('lbl-print-saldo');

  if (lblPrintTotalPago) {
    lblPrintTotalPago.innerText = isPaid ? 'Valor Faturado (Total Pago)' : 'Valor Previsto (Estimativa)';
  }
  if (lblPrintComissao) {
    lblPrintComissao.innerText = isPaid ? 'Comissão Gerada' : 'Comissão Prevista';
  }
  if (lblPrintSaldo) {
    lblPrintSaldo.innerText = isPaid ? 'Saldo Restante' : 'Saldo Estimado Restante';
  }

  const ps = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  ps('print-val-total-pago', formatCurrency(metrics.faturamento));
  ps('print-val-comissao', formatCurrency(metrics.comissao));
  ps('print-val-repasse', formatCurrency(metrics.repasse));
  ps('print-val-saldo', formatCurrency(metrics.saldo));

  // 5. Update print report title and headers
  const printReportTitle = document.getElementById('print-report-title');
  if (printReportTitle) {
    printReportTitle.innerText = isPaid 
      ? 'Montreal Tênis - Relatório de Comissão' 
      : 'Montreal Tênis - Relatório de Comissão Prevista (Estimativa)';
  }

  // 6. Render the student table rows
  renderStudentBreakdown();
}

// ---- Render Student Table ----
function renderStudentBreakdown() {
  const students = currentTab === 'paid' ? studentsPaid : studentsPending;
  const emptyMsg = currentTab === 'paid' 
    ? 'Nenhuma aula paga registrada neste período.' 
    : 'Nenhuma aula pendente registrada neste período.';

  // Update table header columns
  const commHeader = document.querySelector('#students-table th:nth-child(4)');
  const valHeader = document.querySelector('#students-table th:nth-child(3)');
  const classesHeader = document.querySelector('#students-table th:nth-child(2)');

  if (classesHeader) {
    classesHeader.innerText = currentTab === 'paid' ? 'Aulas Pagas' : 'Aulas Previstas';
  }
  if (valHeader) {
    valHeader.innerText = currentTab === 'paid' ? 'Valor Pago (Rateado)' : 'Valor Estimado (Rateado)';
  }
  if (commHeader) {
    commHeader.innerHTML = currentTab === 'paid' 
      ? `Comissão (<span class="comm-col-display">${currentCommissionRate}%</span>)` 
      : `Comissão Prevista (<span class="comm-col-display">${currentCommissionRate}%</span>)`;
  }

  if (students.length === 0) {
    studentsTableRows.innerHTML = `<tr><td colspan="4" class="empty-state">${emptyMsg}</td></tr>`;
    return;
  }
  
  // Sort students by faturamento desc
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

  // Update slider commission percentage displays in case they shifted
  const newCommDisplays = document.querySelectorAll('.comm-col-display');
  newCommDisplays.forEach(el => el.innerText = `${currentCommissionRate}%`);
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
  
  // Recalculate locally without network requests (extremely fast and lag-free)
  calculateAndRenderDashboardData();
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

      // Populate professors dynamically
      await populateProfessors();

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
    checkSession();
    
    // Clear data
    valTotalPago.innerText = 'R$ 0,00';
    valComissaoGerada.innerText = 'R$ 0,00';
    valRepassePago.innerText = 'R$ 0,00';
    valSaldoRestante.innerText = 'R$ 0,00';
    payoutsHistoryRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar o histórico.</td></tr>`;
    studentsTableRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar os alunos.</td></tr>`;

    // Clear operational data
    const opFaturamento = document.getElementById('op-val-faturamento');
    const opTicket = document.getElementById('op-val-ticket-medio');
    const opClientes = document.getElementById('op-val-clientes-ativos');
    const opHoras = document.getElementById('op-val-horas-ocupadas');
    const opEffRows = document.getElementById('op-table-efficiency-rows');
    const opSubRows = document.getElementById('op-table-subcategory-rows');

    if (opFaturamento) opFaturamento.innerText = 'R$ 0,00';
    if (opTicket) opTicket.innerText = 'R$ 0,00';
    if (opClientes) opClientes.innerText = '0';
    if (opHoras) opHoras.innerText = '0,00h';
    if (opEffRows) opEffRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar.</td></tr>`;
    if (opSubRows) opSubRows.innerHTML = `<tr><td colspan="4" class="empty-state">Efetue login para visualizar.</td></tr>`;

    for (const k in chartInstances) {
      if (chartInstances[k]) {
        chartInstances[k].destroy();
        chartInstances[k] = null;
      }
    }
  });
}

// ---- Operational Reports State ----
let currentMainTab = 'commissions';
let chartInstances = {};

function destroyChart(name) {
  if (chartInstances[name]) {
    chartInstances[name].destroy();
    chartInstances[name] = null;
  }
}

// ---- Operational Reports Data Loading & Rendering ----
async function loadOperationalReports() {
  debugLog('loadOperationalReports() disparado.');
  if (!checkSession()) return;

  const year = selectYear.value;
  const month = selectMonth.value;
  const monthStart = `${year}-${month}-01`;
  const monthEnd = getEndOfMonth(monthStart);

  try {
    // 1. Fetch data from Supabase views using direct REST Select
    // Use _pago view to show only real payment methods (excludes cancellations, voids, open items)
    const payParams = `select=*&mes=eq.${monthStart}`;
    const payData = await supabaseSelect('vw_mt_resumo_por_forma_pagamento_pago_mes', payParams);

    const subParams = `select=*&mes=eq.${monthStart}`;
    const subData = await supabaseSelect('vw_mt_ticket_medio_subcategoria_pago_mes', subParams);

    const courtData = await supabaseSelect('vw_mt_ocupacao_quadras_mes', `select=*&mes=eq.${monthStart}`);
    const effData = await supabaseSelect('vw_mt_faturamento_por_hora_ocupada', `select=*&mes=eq.${monthStart}`);
    const freqData = await supabaseSelect('vw_mt_frequencia_clientes_mes', `select=*&mes=eq.${monthStart}`);

    // Also fetch distinct PAYING customers from mt_faturamento_vendas for the correct ticket médio
    // (freqData includes ALL clients with any booking — paid or pending — which would distort the metric)
    const nextMonthStart = (() => {
      const d = new Date(monthStart + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0].substring(0, 8) + '01';
    })();
    const paidVendasData = await supabaseSelect(
      'mt_faturamento_vendas',
      `select=customer_code&paid=eq.true&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}&is_canceled=eq.false&tipo=neq.refund`
    );

    // Fetch Mercado Pago payments
    const mpParams = `select=payment_type_id,payment_method_id,transaction_amount&date_approved=gte.${monthStart}&date_approved=lt.${nextMonthStart}&status=eq.approved`;
    let mpData = [];
    try {
      mpData = await supabaseSelect('mp_pagamentos', mpParams);
    } catch (err) {
      debugError('Erro ao buscar dados do Mercado Pago', err);
    }

    // Process and break down "Pagamento online" in payData
    const onlineItemIndex = payData.findIndex(d => d.pay_method === 'Pagamento online');
    if (onlineItemIndex !== -1) {
      const onlineTotal = parseFloat(payData[onlineItemIndex].valor_total) || 0;
      payData.splice(onlineItemIndex, 1);

      if (onlineTotal > 0) {
        let sumPix = 0;
        let sumCredit = 0;
        let sumSaldo = 0;
        let sumOther = 0;

        mpData.forEach(p => {
          const amt = parseFloat(p.transaction_amount) || 0;
          const type = p.payment_type_id;
          const method = p.payment_method_id;

          if (type === 'bank_transfer' || method === 'pix') {
            sumPix += amt;
          } else if (type === 'credit_card') {
            sumCredit += amt;
          } else if (type === 'account_money') {
            sumSaldo += amt;
          } else {
            sumOther += amt;
          }
        });

        const mpTotal = sumPix + sumCredit + sumSaldo + sumOther;

        if (mpTotal > 0) {
          const scale = onlineTotal / mpTotal;
          if (sumPix > 0) {
            payData.push({
              pay_method: 'Mercado Pago - Pix',
              valor_total: (sumPix * scale).toFixed(2)
            });
          }
          if (sumCredit > 0) {
            payData.push({
              pay_method: 'Mercado Pago - Cartão Crédito',
              valor_total: (sumCredit * scale).toFixed(2)
            });
          }
          if (sumSaldo > 0) {
            payData.push({
              pay_method: 'Mercado Pago - Saldo MP',
              valor_total: (sumSaldo * scale).toFixed(2)
            });
          }
          if (sumOther > 0) {
            payData.push({
              pay_method: 'Mercado Pago - Outro',
              valor_total: (sumOther * scale).toFixed(2)
            });
          }
        } else {
          payData.push({
            pay_method: 'Mercado Pago - Outro',
            valor_total: onlineTotal.toFixed(2)
          });
        }
      }
    }

    // 2. Aggregate current month's KPIs
    let totalFaturamentoLiquido = 0;
    subData.forEach(item => {
      totalFaturamentoLiquido += parseFloat(item.valor_liquido_total) || 0;
    });

    // Count only DISTINCT paying customers — the ones who actually generated the faturamento
    const payingClientsSet = new Set(paidVendasData.map(r => r.customer_code).filter(Boolean));
    const payingClientsCount = payingClientsSet.size;
    const ticketMedio = payingClientsCount > 0 ? (totalFaturamentoLiquido / payingClientsCount) : 0;

    // freqData still used for occupancy context (total booked clients)
    const totalBookedClients = freqData.length;

    let totalHoursOcupadas = 0;
    courtData.forEach(item => {
      const tipo = (item.tipo_operacional || '').toLowerCase();
      const isMaint = tipo.includes('manutenção') || tipo.includes('bloqueio') || tipo.includes('manutencao');
      if (!isMaint) {
        totalHoursOcupadas += parseFloat(item.horas_ocupadas) || 0;
      }
    });

    // Render KPIs
    const opFaturamento = document.getElementById('op-val-faturamento');
    const opTicket = document.getElementById('op-val-ticket-medio');
    const opClientes = document.getElementById('op-val-clientes-ativos');
    const opHoras = document.getElementById('op-val-horas-ocupadas');

    if (opFaturamento) opFaturamento.innerText = formatCurrency(totalFaturamentoLiquido);
    if (opTicket) opTicket.innerText = formatCurrency(ticketMedio);
    if (opClientes) {
      opClientes.innerText = payingClientsCount;
      // Show total booked clients as subtitle context
      const subtitle = opClientes.parentElement.querySelector('.metric-subtitle');
      if (subtitle) {
        subtitle.innerText = `${totalBookedClients} com agendamentos`;
      } else {
        const sub = document.createElement('small');
        sub.className = 'metric-subtitle';
        sub.style.cssText = 'display:block;color:rgba(241,244,224,0.45);font-size:0.72rem;margin-top:2px;';
        sub.innerText = `${totalBookedClients} com agendamentos`;
        opClientes.parentElement.appendChild(sub);
      }
    }
    if (opHoras) opHoras.innerText = `${totalHoursOcupadas.toFixed(2)}h`;

    // Update card label to be clear it's paying clients
    const opClientesLabel = opClientes ? opClientes.closest('.metric-info')?.querySelector('h3') : null;
    if (opClientesLabel) opClientesLabel.innerText = 'Clientes Faturados';


    // 3. Render Detalhamento Tables
    // Table 1: Eficiência
    const efficiencyRows = document.getElementById('op-table-efficiency-rows');
    if (efficiencyRows) {
      if (effData.length === 0) {
        efficiencyRows.innerHTML = `<tr><td colspan="4" class="empty-state">Sem dados de eficiência para este mês.</td></tr>`;
      } else {
        efficiencyRows.innerHTML = effData.map(item => `
          <tr>
            <td>${item.tipo_operacional || 'Geral'}</td>
            <td class="text-center">${item.qtd_bookings || 0}</td>
            <td class="text-right">${parseFloat(item.horas_ocupadas || 0).toFixed(2)}h</td>
            <td class="text-right font-semibold">${formatCurrency(parseFloat(item.faturamento_por_hora_ocupada || 0))}</td>
          </tr>
        `).join('');
      }
    }

    // Table 2: Subcategoria
    const subcategoryRows = document.getElementById('op-table-subcategory-rows');
    if (subcategoryRows) {
      if (subData.length === 0) {
        subcategoryRows.innerHTML = `<tr><td colspan="4" class="empty-state">Sem dados de subcategoria para este mês.</td></tr>`;
      } else {
        subcategoryRows.innerHTML = subData.map(item => `
          <tr>
            <td>${item.subcategoria || 'Geral'}</td>
            <td class="text-center">${item.qtd_clientes || 0}</td>
            <td class="text-right">${formatCurrency(parseFloat(item.valor_liquido_total || 0))}</td>
            <td class="text-right font-semibold">${formatCurrency(parseFloat(item.ticket_medio_por_cliente || 0))}</td>
          </tr>
        `).join('');
      }
    }

    // 4. Build Historical Charts — query REAL data for the past 6 months from Supabase
    const monthsLabels = [];
    const historicalRevenue = [];
    const historicalStudents = [];

    const monthsBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYearInt = parseInt(year, 10);
    const currentMonthInt = parseInt(month, 10);

    // Build list of past 5 months + current month
    const historicMonths = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonthInt - i;
      let y = currentYearInt;
      if (m <= 0) { m += 12; y -= 1; }
      const mStr = String(m).padStart(2, '0');
      historicMonths.push({ label: `${monthsBR[m - 1]}/${y}`, monthStart: `${y}-${mStr}-01` });
    }

    // Fetch subcategory data (faturamento) and frequency data (alunos) for the 6-month window
    const firstMonth = historicMonths[0].monthStart;
    const lastMonth = historicMonths[historicMonths.length - 1].monthStart;

    const [histSubData, histFreqData] = await Promise.all([
      supabaseSelect('vw_mt_ticket_medio_subcategoria_pago_mes', `select=mes,valor_liquido_total&mes=gte.${firstMonth}&mes=lte.${lastMonth}`),
      supabaseSelect('vw_mt_frequencia_clientes_mes', `select=mes,customer_code&mes=gte.${firstMonth}&mes=lte.${lastMonth}`)
    ]);

    // Aggregate into maps keyed by month
    const revenueByMonth = {};
    histSubData.forEach(row => {
      const k = row.mes ? row.mes.split('T')[0].substring(0, 7) : null;
      if (k) revenueByMonth[k] = (revenueByMonth[k] || 0) + (parseFloat(row.valor_liquido_total) || 0);
    });

    const clientsByMonth = {};
    histFreqData.forEach(row => {
      const k = row.mes ? row.mes.split('T')[0].substring(0, 7) : null;
      if (k) {
        if (!clientsByMonth[k]) clientsByMonth[k] = new Set();
        clientsByMonth[k].add(row.customer_code);
      }
    });

    historicMonths.forEach(({ label, monthStart: ms }) => {
      const key = ms.substring(0, 7); // e.g. "2026-06"
      monthsLabels.push(label);
      historicalRevenue.push(revenueByMonth[key] || 0);
      historicalStudents.push(clientsByMonth[key] ? clientsByMonth[key].size : 0);
    });

    // 5. Occupancy History: fetch productive court hours for the same 6-month window
    const histCourtData = await supabaseSelect(
      'vw_mt_ocupacao_quadras_mes',
      `select=mes,resource_name,tipo_operacional,horas_ocupadas&mes=gte.${firstMonth}&mes=lte.${lastMonth}`
    );

    // Aggregate productive hours per month (exclude maintenance/blocking)
    const productiveHoursByMonth = {};
    const courtNamesSet = new Set();
    histCourtData.forEach(row => {
      const tipo = (row.tipo_operacional || '').toLowerCase();
      const isMaint = tipo.includes('manutenção') || tipo.includes('bloqueio') || tipo.includes('manutencao');
      if (isMaint) return; // skip maintenance
      const k = row.mes ? row.mes.split('T')[0].substring(0, 7) : null;
      if (k) {
        productiveHoursByMonth[k] = (productiveHoursByMonth[k] || 0) + (parseFloat(row.horas_ocupadas) || 0);
        if (row.resource_name) courtNamesSet.add(row.resource_name);
      }
    });
    // Also count courts from current month's data if not in history
    courtData.forEach(d => { if (d.resource_name) courtNamesSet.add(d.resource_name); });
    const numCourts = Math.max(courtNamesSet.size, 1);

    // Build % per month = productive hours / (numCourts × available hours for that month)
    const occupancyHistoryPct = historicMonths.map(({ monthStart: ms }) => {
      const key = ms.substring(0, 7);
      const yy = parseInt(ms.substring(0, 4), 10);
      const mm = parseInt(ms.substring(5, 7), 10);
      const avail = calcTotalAvailableHoursForMonth(yy, mm) * numCourts;
      const prodH = productiveHoursByMonth[key] || 0;
      return avail > 0 ? parseFloat((prodH / avail * 100).toFixed(1)) : 0;
    });

    // 6. Ticket Médio History: paying clients per month over the same 6-month window
    const histPaidVendasData = await supabaseSelect(
      'mt_faturamento_vendas',
      `select=customer_code,pay_date&paid=eq.true&is_canceled=eq.false&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}&tipo=neq.refund`
    );

    // Group distinct paying customers by month (YYYY-MM key)
    const payingClientsByMonth = {};
    histPaidVendasData.forEach(row => {
      if (!row.pay_date) return;
      const k = row.pay_date.substring(0, 7); // "2026-06"
      if (!payingClientsByMonth[k]) payingClientsByMonth[k] = new Set();
      if (row.customer_code) payingClientsByMonth[k].add(row.customer_code);
    });

    // Ticket médio per month = revenue / paying clients
    const ticketMedioHistory = historicMonths.map(({ monthStart: ms }) => {
      const key = ms.substring(0, 7);
      const rev = revenueByMonth[key] || 0;
      const clients = payingClientsByMonth[key] ? payingClientsByMonth[key].size : 0;
      return clients > 0 ? parseFloat((rev / clients).toFixed(2)) : 0;
    });

    renderChartRevenueHistory(monthsLabels, historicalRevenue, historicalStudents);
    renderChartPaymethods(payData);
    renderChartSubcategories(subData);
    renderChartCourtOccupancy(courtData, parseInt(year, 10), parseInt(month, 10));
    renderChartOccupancyHistory(monthsLabels, occupancyHistoryPct);
    renderChartTicketHistory(monthsLabels, ticketMedioHistory);

  } catch (err) {
    debugError('Erro ao carregar relatórios operacionais', err);
  }
}

// ---- Chart Rendering Handlers ----

function renderChartOccupancyHistory(labels, pctValues) {
  destroyChart('occupancyHistory');
  const canvas = document.getElementById('chart-occupancy-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  chartInstances['occupancyHistory'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ocupação Produtiva (%)',
        data: pctValues,
        borderColor: '#2a9d8f',
        backgroundColor: 'rgba(42, 157, 143, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#2a9d8f',
        pointBorderColor: '#1c1c1c',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw.toFixed(1)}% das horas disponíveis (todas as quadras)`
          }
        },
        annotation: {} // placeholder for future reference lines
      },
      scales: {
        x: {
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: {
            color: 'rgba(241, 244, 224, 0.7)',
            font: { family: 'Hanken Grotesk' },
            callback: v => v + '%'
          }
        }
      }
    }
  });
}

function renderChartTicketHistory(labels, values) {
  destroyChart('ticketHistory');
  const canvas = document.getElementById('chart-ticket-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  chartInstances['ticketHistory'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ticket Médio (R$)',
        data: values,
        borderColor: '#e9c46a',
        backgroundColor: 'rgba(233, 196, 106, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#e9c46a',
        pointBorderColor: '#1c1c1c',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } }
        },
        y: {
          min: 0,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: {
            color: 'rgba(241, 244, 224, 0.7)',
            font: { family: 'Hanken Grotesk' },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR')
          }
        }
      }
    }
  });
}


function renderChartRevenueHistory(labels, revenues, students) {

  destroyChart('revenueHistory');
  const canvas = document.getElementById('chart-revenue-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  chartInstances['revenueHistory'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: revenues,
          backgroundColor: '#C05131',
          borderColor: '#C05131',
          borderWidth: 1,
          yAxisID: 'y',
          order: 2
        },
        {
          label: 'Alunos Ativos',
          data: students,
          type: 'line',
          borderColor: '#f1f4e0',
          backgroundColor: '#f1f4e0',
          borderWidth: 3,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#f1f4e0', font: { family: 'Hanken Grotesk' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(241, 244, 224, 0.05)' }, ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' }, callback: value => 'R$ ' + value.toLocaleString('pt-BR') }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' }, stepSize: 5 }
        }
      }
    }
  });
}

function renderChartPaymethods(data) {
  destroyChart('paymethods');
  const canvas = document.getElementById('chart-paymethod');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = data.map(d => d.pay_method || 'Outro');
  const values = data.map(d => parseFloat(d.valor_total) || 0);

  if (labels.length === 0) {
    labels.push('Sem dados');
    values.push(0);
  }

  chartInstances['paymethods'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#C05131', // Cartão Crédito (Saibro)
          '#2a9d8f', // Pix (Teal)
          '#e9c46a', // tarjeta (Yellow)
          '#f4a261', // Cartão Débito (Warm Orange)
          '#457b9d', // efectivo (Muted Blue)
          '#9b5de5', // transferencia (Purple)
          '#3a86c8', // Mercado Pago - Pix (Bright Blue)
          '#e76f51', // Mercado Pago - Cartão Crédito (Coral)
          '#06d6a0', // Mercado Pago - Saldo MP (Mint Green)
          '#8d99ae', // Mercado Pago - Outro (Slate Gray)
          '#ff006e', // Reserva 1 (Magenta)
          '#f15bb5'  // Reserva 2 (Pink)
        ],
        borderWidth: 1,
        borderColor: '#1c1c1c'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: 'rgba(241, 244, 224, 0.8)', font: { family: 'Hanken Grotesk', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: context => {
              const val = context.raw || 0;
              return ` ${context.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            }
          }
        }
      }
    }
  });
}

function renderChartSubcategories(data) {
  destroyChart('subcategories');
  const canvas = document.getElementById('chart-subcategory');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = data.map(d => d.subcategoria || 'Geral');
  const values = data.map(d => parseFloat(d.valor_liquido_total) || 0);

  if (labels.length === 0) {
    labels.push('Sem dados');
    values.push(0);
  }

  const total = values.reduce((sum, v) => sum + v, 0);

  // Custom plugin: draws % label at the end of each horizontal bar
  const percentageLabelPlugin = {
    id: 'subcategoryPercentageLabels',
    afterDatasetsDraw(chart) {
      const { ctx: c, data: d } = chart;
      const total = d.datasets[0].data.reduce((sum, v) => sum + v, 0);
      if (total === 0) return;

      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const value = d.datasets[0].data[index];
        const pct = ((value / total) * 100).toFixed(1).replace('.', ',');
        const xEnd = bar.x + 6;
        const yCenter = bar.y;

        c.save();
        c.fillStyle = 'rgba(241, 244, 224, 0.65)';
        c.font = '600 11px Hanken Grotesk, sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`${pct}%`, xEnd, yCenter);
        c.restore();
      });
    }
  };

  chartInstances['subcategories'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Faturamento (R$)',
        data: values,
        backgroundColor: '#2a9d8f',
        borderColor: '#2a9d8f',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { right: 52 }   // make room for the % label text
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const val = context.raw || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1).replace('.', ',') : '0,0';
              return ` R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}  (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' }, callback: value => 'R$ ' + value.toLocaleString('pt-BR') }
        },
        y: {
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } }
        }
      }
    },
    plugins: [percentageLabelPlugin]
  });
}


// Calculates total available court-hours in a given month based on school operating schedule:
// Mon-Fri: 7h-22h (last class 21h) = 15 h/day | Sat: 7h-18h = 11 h/day | Sun: 7h-12h = 5 h/day
function calcTotalAvailableHoursForMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 0) total += 5;
    else if (dow === 6) total += 11;
    else total += 15;
  }
  return total;
}

function renderChartCourtOccupancy(data, yearInt, monthInt) {
  destroyChart('courtOccupancy');
  const canvas = document.getElementById('chart-court-occupancy');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');


  // Separate productive hours vs maintenance per court
  const courtProductive = {};
  const courtMaintenance = {};
  const courtProductiveH = {}; // raw hours for tooltip
  const courtMaintenanceH = {};

  data.forEach(d => {
    const name = d.resource_name || 'Desconhecida';
    const hours = parseFloat(d.horas_ocupadas) || 0;
    const tipo = (d.tipo_operacional || '').toLowerCase();
    if (tipo.includes('manutenção') || tipo.includes('bloqueio') || tipo.includes('manutencao')) {
      courtMaintenance[name] = (courtMaintenance[name] || 0) + hours;
      courtMaintenanceH[name] = (courtMaintenanceH[name] || 0) + hours;
    } else {
      courtProductive[name] = (courtProductive[name] || 0) + hours;
      courtProductiveH[name] = (courtProductiveH[name] || 0) + hours;
    }
  });

  const labels = [...new Set(data.map(d => d.resource_name || 'Desconhecida'))].sort();
  if (labels.length === 0) { labels.push('Sem dados'); }

  const totalAvail = calcTotalAvailableHoursForMonth(yearInt, monthInt);

  const productivePct = labels.map(l => totalAvail > 0 ? +((courtProductive[l] || 0) / totalAvail * 100).toFixed(1) : 0);
  const maintenancePct = labels.map(l => totalAvail > 0 ? +((courtMaintenance[l] || 0) / totalAvail * 100).toFixed(1) : 0);
  const productiveH = labels.map(l => courtProductiveH[l] || 0);
  const maintenanceH = labels.map(l => courtMaintenanceH[l] || 0);

  // Custom plugin: draws total % label after each stacked bar
  const pctLabelPlugin = {
    id: 'courtPctLabels',
    afterDatasetsDraw(chart) {
      const { ctx: c } = chart;
      const meta0 = chart.getDatasetMeta(0);
      const meta1 = chart.getDatasetMeta(1);
      meta0.data.forEach((bar, i) => {
        const bar1 = meta1.data[i];
        const xEnd = Math.max(bar.x, bar1 ? bar1.x : 0) + 6;
        const yCenter = bar.y;
        const total = productivePct[i] + maintenancePct[i];
        c.save();
        c.fillStyle = 'rgba(241, 244, 224, 0.7)';
        c.font = '600 11px Hanken Grotesk, sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`${total.toFixed(1)}%`, xEnd, yCenter);
        c.restore();
      });
    }
  };

  chartInstances['courtOccupancy'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Uso produtivo (aulas/locações)',
          data: productivePct,
          backgroundColor: '#2a9d8f',
          borderColor: '#2a9d8f',
          borderWidth: 1,
          rawHours: productiveH
        },
        {
          label: 'Manutenção / Bloqueio',
          data: maintenancePct,
          backgroundColor: 'rgba(192, 81, 49, 0.6)',
          borderColor: 'rgba(192, 81, 49, 0.8)',
          borderWidth: 1,
          rawHours: maintenanceH
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 52 } },
      plugins: {
        legend: {
          labels: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: context => {
              const ds = context.dataset;
              const i = context.dataIndex;
              const pct = context.raw || 0;
              const h = ds.rawHours ? ds.rawHours[i] : 0;
              return ` ${ds.label}: ${pct.toFixed(1)}% (${h.toFixed(0)}h de ${totalAvail}h disponíveis)`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          max: 100,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' }, callback: v => v + '%' }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } }
        }
      }
    },
    plugins: [pctLabelPlugin]
  });
}

// ---- Main Tabs Event Listeners ----
const mainTabCommissions = document.getElementById('main-tab-commissions');
const mainTabOperational = document.getElementById('main-tab-operational');
const mainTabFinancial = document.getElementById('main-tab-financial');
const sectionCommissions = document.getElementById('section-commissions');
const sectionOperational = document.getElementById('section-operational');
const sectionFinancial = document.getElementById('section-financial');

// ---- ROI Global Cache ----
let savedDreData = null;
let savedHistoricMonths = null;
let savedCurrentMonthKey = null;

function updateRoiAnalysis(dreData, currentMonthKey, historicMonths) {
  savedDreData = dreData;
  savedHistoricMonths = historicMonths;
  savedCurrentMonthKey = currentMonthKey;

  calculateAndRenderRoi();
}

function calculateAndRenderRoi() {
  if (!savedDreData || !savedHistoricMonths || !savedCurrentMonthKey) return;

  const investmentInput = document.getElementById('roi-input-investment');
  const metricSelect = document.getElementById('roi-select-metric');

  if (!investmentInput || !metricSelect) return;

  const investment = parseFloat(investmentInput.value) || 0;
  const metric = metricSelect.value;

  if (investment <= 0) {
    const elRetorno = document.getElementById('roi-val-retorno-periodo');
    const elMensal = document.getElementById('roi-val-mensal');
    const elAnualizado = document.getElementById('roi-val-anualizado');
    const elPayback = document.getElementById('roi-val-payback');

    if (elRetorno) elRetorno.innerText = 'R$ 0,00';
    if (elMensal) elMensal.innerText = '0,00%';
    if (elAnualizado) elAnualizado.innerText = '0,00%';
    if (elPayback) elPayback.innerText = 'N/A';
    
    const body = document.getElementById('fin-roi-body');
    if (body) {
      body.innerHTML = `<tr><td colspan="5" class="empty-state">Insira um valor de investimento válido.</td></tr>`;
    }
    return;
  }

  function getReturn(d) {
    if (metric === 'ebitda') {
      return d.ebitda;
    } else if (metric === 'caixa') {
      return d.ebitda - d.ir;
    } else if (metric === 'lucroLiquido') {
      return d.lucroLiquido;
    }
    return 0;
  }

  // Active Month Highlight Metrics
  const activeMonthData = savedDreData[savedCurrentMonthKey];
  if (activeMonthData) {
    const retVal = getReturn(activeMonthData);
    const monthlyRoi = (retVal / investment) * 100;
    const annualizedRoi = monthlyRoi * 12;

    const elRetorno = document.getElementById('roi-val-retorno-periodo');
    const elMensal = document.getElementById('roi-val-mensal');
    const elAnualizado = document.getElementById('roi-val-anualizado');
    const elPayback = document.getElementById('roi-val-payback');

    if (elRetorno) elRetorno.innerText = formatCurrency(retVal);
    
    if (elMensal) {
      elMensal.innerText = monthlyRoi.toFixed(3).replace('.', ',') + '%';
      elMensal.style.color = retVal < 0 ? '#e63946' : 'var(--color-saibro)';
    }

    if (elAnualizado) {
      elAnualizado.innerText = annualizedRoi.toFixed(2).replace('.', ',') + '%';
      elAnualizado.style.color = retVal < 0 ? '#e63946' : '#2ec4b6';
    }

    if (elPayback) {
      if (retVal > 0) {
        const paybackYears = investment / (retVal * 12);
        elPayback.innerText = paybackYears > 100 ? '> 100 anos' : paybackYears.toFixed(1).replace('.', ',') + ' anos';
        elPayback.style.color = '#e9c46a';
      } else {
        elPayback.innerText = 'Infinito';
        elPayback.style.color = '#e63946';
      }
    }
  }

  // Populate ROI history table
  const body = document.getElementById('fin-roi-body');
  if (body) {
    body.innerHTML = savedHistoricMonths.map(m => {
      const d = savedDreData[m.key];
      const retVal = getReturn(d);
      
      const monthlyRoi = (retVal / investment) * 100;
      const annualizedRoi = monthlyRoi * 12;

      let paybackStr = 'Infinito';
      let paybackClass = 'text-outflow';
      if (retVal > 0) {
        const paybackYears = investment / (retVal * 12);
        paybackStr = paybackYears > 100 ? '> 100 anos' : paybackYears.toFixed(1).replace('.', ',') + ' anos';
        paybackClass = '';
      }

      const retClass = retVal < 0 ? 'text-outflow' : (retVal > 0 ? 'text-inflow' : '');
      const roiClass = retVal < 0 ? 'text-outflow' : '';

      return `
        <tr>
          <td>${m.label}</td>
          <td class="text-right ${retClass}">${formatCurrency(retVal)}</td>
          <td class="text-right ${roiClass}">${monthlyRoi.toFixed(3).replace('.', ',')}%</td>
          <td class="text-right ${roiClass}" style="font-weight: 600;">${annualizedRoi.toFixed(2).replace('.', ',')}%</td>
          <td class="text-right ${paybackClass}">${paybackStr}</td>
        </tr>
      `;
    }).join('');
  }
}

// ---- Financial Reports Data Loading & Rendering ----
async function loadFinancialReports() {
  debugLog('loadFinancialReports() disparado.');
  if (!checkSession()) return;

  const year = selectYear.value;
  const month = selectMonth.value;
  const monthStart = `${year}-${month}-01`;
  const monthEnd = getEndOfMonth(monthStart);

  // Set up 6 months window
  const monthsBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentYearInt = parseInt(year, 10);
  const currentMonthInt = parseInt(month, 10);

  const historicMonths = [];
  for (let i = 5; i >= 0; i--) {
    let m = currentMonthInt - i;
    let y = currentYearInt;
    if (m <= 0) { m += 12; y -= 1; }
    const mStr = String(m).padStart(2, '0');
    historicMonths.push({ key: `${y}-${mStr}`, label: `${monthsBR[m - 1]}/${y}`, monthStart: `${y}-${mStr}-01` });
  }

  const firstMonth = historicMonths[0].monthStart;

  try {
    debugLog('Buscando dados financeiros do Supabase (janela de 6 meses)...');
    const nextMonthStart = (() => {
      const d = new Date(monthStart + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0].substring(0, 8) + '01';
    })();

    const projectionEnd = (() => {
      const d = new Date(monthEnd + 'T00:00:00');
      d.setMonth(d.getMonth() + 3);
      return getEndOfMonth(d.toISOString().split('T')[0]);
    })();

    const procfyParams = `due_date=gte.${firstMonth}&due_date=lte.${projectionEnd}`;
    const interParams = `data_movimento=gte.${firstMonth}&data_movimento=lte.${monthEnd}`;
    const salesParams = `select=valor_faturamento,pay_date&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}`;
    const commParams = `select=booking_value,booking_date,is_paid,participant_name,start_time,booking_type,description,professor,customer_code&booking_date=gte.${firstMonth}&booking_date=lte.${monthEnd}`;
    const payParams = `payment_date=gte.${firstMonth}&payment_date=lt.${nextMonthStart}`;
    const mpParams = `date_approved=gte.${firstMonth}&date_approved=lt.${nextMonthStart}&status=eq.approved`;

    const [allProcfyData, allInterData, allSalesData, allCommData, allPaymentMethodsData, allMpPaymentsData] = await Promise.all([
      supabaseSelect('procfy_lancamentos', procfyParams),
      supabaseSelect('inter_movimentos_processados', interParams),
      supabaseSelect('vw_mt_faturamento_itens_pago', salesParams),
      supabaseSelect('vw_mt_comissoes_detalhadas', commParams),
      supabaseSelect('mt_faturamento_pagamentos', payParams),
      supabaseSelect('mp_pagamentos', mpParams)
    ]);

    debugLog(`Lançamentos Procfy: ${allProcfyData.length} linhas.`);
    debugLog(`Movimentos Inter: ${allInterData.length} linhas.`);
    debugLog(`Lançamentos Vendas: ${allSalesData.length} linhas.`);
    debugLog(`Agendamentos Comissões: ${allCommData.length} linhas.`);
    debugLog(`Lançamentos Pagamentos (MatchPoint): ${allPaymentMethodsData.length} linhas.`);
    debugLog(`Lançamentos Mercado Pago: ${allMpPaymentsData.length} linhas.`);

    // 1. Filter current month data locally
    const currentMonthKey = `${year}-${month}`;
    const currentProcfy = allProcfyData.filter(row => row.due_date && row.due_date.substring(0, 7) === currentMonthKey);
    const currentInter = allInterData.filter(row => row.data_movimento && row.data_movimento.substring(0, 7) === currentMonthKey);

    // 2. Perform Cash Flow (DFC) calculations
    const monthlyData = {};
    const allCategories = { fco: new Set(), fci: new Set(), fcs: new Set() };

    historicMonths.forEach(({ key }) => {
      monthlyData[key] = {
        fco: { categories: {}, net: 0.0 },
        fci: { categories: {}, net: 0.0 },
        fcs: { categories: {}, net: 0.0 },
        net: 0.0,
        initial: 0.0,
        final: 0.0
      };
    });

    // Process Procfy paid transactions for DFC (only June 2026 onwards)
    allProcfyData.forEach(tx => {
      if (!tx.paid) return;
      const monthKey = tx.due_date ? tx.due_date.substring(0, 7) : '';
      if (!monthlyData[monthKey] || monthKey < '2026-06') return;

      const amount = parseFloat(tx.amount) || 0;
      const flow = tx.cost_center_descricao;
      const category = tx.category_name || 'Sem Categoria';
      const isRevenue = tx.transaction_type === 'revenue';
      const sign = isRevenue ? 1 : -1;
      const value = sign * amount;

      let target = null;
      if (flow === 'Operação') {
        target = monthlyData[monthKey].fco;
        allCategories.fco.add(category);
      } else if (flow === 'Investimentos') {
        target = monthlyData[monthKey].fci;
        allCategories.fci.add(category);
      } else if (flow === 'Sócios') {
        target = monthlyData[monthKey].fcs;
        allCategories.fcs.add(category);
      }

      if (target) {
        target.categories[category] = (target.categories[category] || 0.0) + value;
        target.net += value;
        monthlyData[monthKey].net += value;
      }
    });

    // Process Banco Inter CDB resgates for DFC (only June 2026 onwards)
    allInterData.forEach(tx => {
      const desc = (tx.descricao || '').toLowerCase();
      const title = (tx.titulo || '').toLowerCase();
      const isResgate = desc.includes('resgate') || desc.includes('cdb') || title.includes('resgate');
      if (isResgate) {
        const monthKey = tx.data_movimento ? tx.data_movimento.substring(0, 7) : '';
        if (!monthlyData[monthKey] || monthKey < '2026-06') return;

        const amount = Math.abs(parseFloat(tx.valor_com_sinal)) || 0;
        const category = 'Resgate de Aplicação Financeira (CDB)';
        
        allCategories.fci.add(category);
        monthlyData[monthKey].fci.categories[category] = (monthlyData[monthKey].fci.categories[category] || 0.0) + amount;
        monthlyData[monthKey].fci.net += amount;
        monthlyData[monthKey].net += amount;
      }
    });

    // Solve starting and ending balances for DFC
    const monthKeys = historicMonths.map(m => m.key);
    const n = monthKeys.length;

    for (let i = 0; i < n; i++) {
      const mKey = monthKeys[i];
      if (mKey < '2026-05') {
        monthlyData[mKey].initial = 0.0;
        monthlyData[mKey].final = 0.0;
      } else if (mKey === '2026-05') {
        monthlyData[mKey].initial = 0.0;
        monthlyData[mKey].final = 7280.98;
      } else if (mKey === '2026-06') {
        monthlyData[mKey].initial = 7280.98;
        monthlyData[mKey].final = 7280.98 + monthlyData[mKey].net;
      } else {
        const prevKey = monthKeys[i - 1];
        monthlyData[mKey].initial = monthlyData[prevKey].final;
        monthlyData[mKey].final = monthlyData[mKey].initial + monthlyData[mKey].net;
      }
    }

    // Render Metric Cards for the CURRENT selected month
    const curData = monthlyData[currentMonthKey] || { initial: 0.0, fco: { net: 0.0 }, fci: { net: 0.0 }, fcs: { net: 0.0 }, final: 0.0 };
    const curInitial = curData.initial;
    const curFcoNet = curData.fco.net;
    const curFciNet = curData.fci.net;
    const curFcsNet = curData.fcs.net;
    const curFinal = curData.final;

    const elInicialSubtitle = document.getElementById('fin-val-saldo-inicial-subtitle');
    if (elInicialSubtitle) {
      elInicialSubtitle.innerText = 'Saldo Inicial: ' + formatCurrency(curInitial);
    }
    const elFco = document.getElementById('fin-val-fco');
    if (elFco) elFco.innerText = formatCurrency(curFcoNet);
    const elFci = document.getElementById('fin-val-fci');
    if (elFci) elFci.innerText = formatCurrency(curFciNet);
    const elFcs = document.getElementById('fin-val-fcs');
    if (elFcs) elFcs.innerText = formatCurrency(curFcsNet);
    
    const elFinal = document.getElementById('fin-val-saldo-final');
    if (elFinal) {
      elFinal.innerText = formatCurrency(curFinal);
      if (curFinal < 0) {
        elFinal.style.color = '#e63946';
      } else {
        elFinal.style.color = '#2ec4b6';
      }
    }

    // 3. Render DFC Table
    // Populate headers
    const headerRow = document.getElementById('fin-dfc-header-row');
    if (headerRow) {
      headerRow.innerHTML = `<th>Categoria / Fluxo</th>` + historicMonths.map(m => `<th class="text-right">${m.label}</th>`).join('');
    }

    // Helper to generate a DFC row
    function makeDfcRowHtml(title, rowClasses, dataGetter) {
      const cells = historicMonths.map(m => {
        const val = dataGetter(m.key);
        let valClass = '';
        if (val > 0) valClass = 'text-inflow';
        else if (val < 0) valClass = 'text-outflow';
        
        const isBalanceRow = rowClasses && rowClasses.includes('dfc-balance-row');
        const formatted = val !== 0 ? formatCurrency(val) : (isBalanceRow ? formatCurrency(0) : '--');
        return `<td class="text-right ${valClass}">${formatted}</td>`;
      }).join('');
      
      const classAttr = rowClasses && rowClasses.length ? `class="${rowClasses.join(' ')}"` : '';
      const isChild = rowClasses && rowClasses.some(c => c.endsWith('-child-row'));
      const styleAttr = isChild ? 'style="display: none;"' : '';
      return `<tr ${classAttr} ${styleAttr}><td>${title}</td>${cells}</tr>`;
    }

    // Helper to generate flow header row
    function makeDfcHeaderRowHtml(title, flowKey, rowClasses) {
      const cells = historicMonths.map(m => {
        const val = monthlyData[m.key][flowKey].net;
        let valClass = '';
        if (val > 0) valClass = 'text-inflow';
        else if (val < 0) valClass = 'text-outflow';
        return `<td class="text-right ${valClass}">${val !== 0 ? formatCurrency(val) : formatCurrency(0)}</td>`;
      }).join('');
      
      const classes = [...(rowClasses || [])];
      if (!classes.includes('collapsed')) {
        classes.push('collapsed');
      }
      const classAttr = `class="${classes.join(' ')}"`;
      return `<tr ${classAttr} data-target="${flowKey}-child-row"><td><span class="arrow-indicator">▶</span>${title}</td>${cells}</tr>`;
    }

    // Sort categories: positive first for the selected month
    const fcoCatsArray = Array.from(allCategories.fco);
    fcoCatsArray.sort((a, b) => {
      const valA = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fco.categories[a]) || 0.0;
      const valB = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fco.categories[b]) || 0.0;
      return valB - valA;
    });

    const fciCatsArray = Array.from(allCategories.fci);
    fciCatsArray.sort((a, b) => {
      const valA = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fci.categories[a]) || 0.0;
      const valB = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fci.categories[b]) || 0.0;
      return valB - valA;
    });

    const fcsCatsArray = Array.from(allCategories.fcs);
    fcsCatsArray.sort((a, b) => {
      const valA = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fcs.categories[a]) || 0.0;
      const valB = (monthlyData[currentMonthKey] && monthlyData[currentMonthKey].fcs.categories[b]) || 0.0;
      return valB - valA;
    });

    // Assemble HTML for DFC
    let dfcBodyHtml = '';
    dfcBodyHtml += makeDfcRowHtml('Saldo Inicial (Caixa)', ['dfc-balance-row'], (key) => monthlyData[key].initial);
    dfcBodyHtml += makeDfcHeaderRowHtml('Fluxo Operacional (FCO)', 'fco', ['flow-header-row', 'fco-header']);
    fcoCatsArray.forEach(cat => {
      dfcBodyHtml += makeDfcRowHtml(cat, ['fco-child-row'], (key) => (monthlyData[key] && monthlyData[key].fco.categories[cat]) || 0.0);
    });
    dfcBodyHtml += makeDfcHeaderRowHtml('Fluxo de Investimento (FCI)', 'fci', ['flow-header-row', 'fci-header']);
    fciCatsArray.forEach(cat => {
      dfcBodyHtml += makeDfcRowHtml(cat, ['fci-child-row'], (key) => (monthlyData[key] && monthlyData[key].fci.categories[cat]) || 0.0);
    });
    dfcBodyHtml += makeDfcHeaderRowHtml('Fluxo de Sócios (FCS)', 'fcs', ['flow-header-row', 'fcs-header']);
    fcsCatsArray.forEach(cat => {
      dfcBodyHtml += makeDfcRowHtml(cat, ['fcs-child-row'], (key) => (monthlyData[key] && monthlyData[key].fcs.categories[cat]) || 0.0);
    });
    dfcBodyHtml += makeDfcRowHtml('Saldo Final (Caixa)', ['dfc-balance-row'], (key) => monthlyData[key].final);

    const dfcBody = document.getElementById('fin-dfc-body');
    if (dfcBody) {
      dfcBody.innerHTML = dfcBodyHtml;
    }

    // 4. Perform DRE Calculations
    const round2 = val => Math.round(val * 100) / 100;
    const dreData = {};
    const operationalExpenseCategories = new Set();

    historicMonths.forEach(({ key }) => {
      dreData[key] = {
        receitaBruta: 0.0,
        impostos: 0.0,
        receitaLiquida: 0.0,
        comissao: 0.0,
        energia: 0.0,
        taxasProcessamento: 0.0,
        lucroBruto: 0.0,
        despesasOperacionais: 0.0,
        despesasOperacionaisCategories: {},
        ebitda: 0.0,
        depreciacao: 0.0,
        ebit: 0.0,
        ir: 0.0,
        lucroLiquido: 0.0
      };
    });

    // Populate DRE Gross Revenue
    allSalesData.forEach(sale => {
      const monthKey = sale.pay_date ? sale.pay_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;
      dreData[monthKey].receitaBruta += parseFloat(sale.valor_faturamento) || 0.0;
    });

    // Populate DRE Commissions
    allCommData.forEach(row => {
      if (!row.is_paid) return;
      const monthKey = row.booking_date ? row.booking_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;
      
      const val = parseFloat(row.booking_value) || 0.0;
      dreData[monthKey].comissao += val * (currentCommissionRate / 100);
    });

    // Populate DRE Expenses (Operation cost center)
    allProcfyData.forEach(tx => {
      if (!tx.paid) return;
      if (tx.cost_center_descricao !== 'Operação') return;
      if (tx.transaction_type === 'revenue') return;

      const monthKey = tx.due_date ? tx.due_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;

      const amount = parseFloat(tx.amount) || 0.0;
      const category = tx.category_name || 'Outras Despesas';

      if (category === 'Energia Elétrica') {
        dreData[monthKey].energia += amount;
      } else {
        dreData[monthKey].despesasOperacionais += amount;
        dreData[monthKey].despesasOperacionaisCategories[category] = 
          (dreData[monthKey].despesasOperacionaisCategories[category] || 0.0) + amount;
        operationalExpenseCategories.add(category);
      }
    });

    // Populate DRE processing fees
    allMpPaymentsData.forEach(mp => {
      const dateStr = mp.date_approved;
      if (!dateStr) return;
      const monthKey = dateStr.substring(0, 7);
      if (!dreData[monthKey]) return;
      dreData[monthKey].taxasProcessamento += parseFloat(mp.fee_amount) || 0.0;
    });

    allPaymentMethodsData.forEach(pay => {
      const payMethod = pay.pay_method;
      if (payMethod === 'Pagamento online') return;

      const dateStr = pay.payment_date;
      if (!dateStr) return;
      const monthKey = dateStr.substring(0, 7);
      if (!dreData[monthKey]) return;

      const amt = parseFloat(pay.amount) || 0.0;
      let rate = 0.0;
      if (payMethod === 'tarjeta' || payMethod === 'Cartão Crédito') {
        rate = 0.0193;
      } else if (payMethod === 'Cartão Débito') {
        rate = 0.0099;
      }
      dreData[monthKey].taxasProcessamento += amt * rate;
    });

    // Round inputs and solve intermediate totals
    historicMonths.forEach(({ key }) => {
      const d = dreData[key];
      d.receitaBruta = round2(d.receitaBruta);
      d.comissao = round2(d.comissao);
      d.energia = round2(d.energia);
      d.taxasProcessamento = round2(d.taxasProcessamento);
      d.despesasOperacionais = round2(d.despesasOperacionais);

      // If no activity (revenue is 0), keep everything zeroed
      if (d.receitaBruta === 0.0) {
        d.impostos = 0.0;
        d.receitaLiquida = 0.0;
        d.comissao = 0.0;
        d.energia = 0.0;
        d.taxasProcessamento = 0.0;
        d.lucroBruto = 0.0;
        d.despesasOperacionais = 0.0;
        d.despesasOperacionaisCategories = {};
        d.ebitda = 0.0;
        d.depreciacao = 0.0;
        d.ebit = 0.0;
        d.ir = 0.0;
        d.lucroLiquido = 0.0;
        return;
      }

      // Calculate Simples Nacional based on (Gross Revenue - Commission)
      const baseCalculo = Math.max(0.0, d.receitaBruta - d.comissao);
      const rbt12 = baseCalculo * 12;

      let nominalRate = 0.0;
      let deductible = 0.0;

      if (rbt12 <= 180000.0) {
        nominalRate = 0.06;
        deductible = 0.0;
      } else if (rbt12 <= 360000.0) {
        nominalRate = 0.112;
        deductible = 9360.0;
      } else if (rbt12 <= 720000.0) {
        nominalRate = 0.135;
        deductible = 17640.0;
      } else if (rbt12 <= 1800000.0) {
        nominalRate = 0.16;
        deductible = 35640.0;
      } else if (rbt12 <= 3600000.0) {
        nominalRate = 0.143;
        deductible = 125640.0;
      } else {
        nominalRate = 0.19;
        deductible = 378000.0;
      }

      const effectiveRate = rbt12 > 0 ? (rbt12 * nominalRate - deductible) / rbt12 : 0.0;
      const totalSimples = baseCalculo * Math.max(0.0, effectiveRate);

      // Separate IR (4.00%) from Impostos (96.00%)
      d.ir = round2(totalSimples * 0.04);
      d.impostos = round2(totalSimples * 0.96);

      d.receitaLiquida = round2(d.receitaBruta - d.impostos);
      d.lucroBruto = round2(d.receitaLiquida - d.comissao - d.energia - d.taxasProcessamento);
      d.ebitda = round2(d.lucroBruto - d.despesasOperacionais);
      
      // Depreciation (Fixed 7666.67 per active month)
      d.depreciacao = 7666.67;
      d.ebit = round2(d.ebitda - d.depreciacao);
      d.lucroLiquido = round2(d.ebit - d.ir);
    });

    // 5. Render DRE Table
    const dreHeaderRow = document.getElementById('fin-dre-header-row');
    if (dreHeaderRow) {
      dreHeaderRow.innerHTML = `<th>Categoria / Conta</th>` + historicMonths.map(m => `<th class="text-right">${m.label}</th>`).join('');
    }

    // Helper to generate DRE Cell with Vertical Analysis (AV)
    function makeDreCellHtml(val, receitaLiquida, isNegativeRed = false, isPositiveGreen = false) {
      const formattedVal = formatCurrency(val);
      const pct = receitaLiquida > 0 ? (val / receitaLiquida * 100) : 0.0;
      const formattedPct = pct.toFixed(1).replace('.', ',') + '%';
      
      let colorClass = '';
      if (isNegativeRed && val < 0) colorClass = 'text-outflow';
      else if (isPositiveGreen && val > 0) colorClass = 'text-inflow';
      
      return `
        <td class="text-right ${colorClass}">
          <span>${formattedVal}</span>
          <span class="vertical-analysis">${formattedPct}</span>
        </td>
      `;
    }

    // Helper to generate a standard DRE row
    function renderDreRowHtml(title, rowClasses, getValueFn, isNegativeRed = false, isPositiveGreen = false) {
      const cells = historicMonths.map(m => {
        const d = dreData[m.key];
        const val = getValueFn(d);
        return makeDreCellHtml(val, d.receitaLiquida, isNegativeRed, isPositiveGreen);
      }).join('');
      
      const classAttr = rowClasses && rowClasses.length ? `class="${rowClasses.join(' ')}"` : '';
      const isChild = rowClasses && rowClasses.includes('dre-op-child-row');
      const styleAttr = isChild ? 'style="display: none;"' : '';
      return `<tr ${classAttr} ${styleAttr}><td>${title}</td>${cells}</tr>`;
    }

    // Helper to generate collapsible header row for Despesas Operacionais in DRE
    function renderDreCollapsibleHeaderRowHtml(title, targetKey, getValueFn) {
      const cells = historicMonths.map(m => {
        const d = dreData[m.key];
        const val = getValueFn(d);
        return makeDreCellHtml(val, d.receitaLiquida, true, false);
      }).join('');
      
      return `
        <tr class="flow-header-row collapsed" data-target="${targetKey}">
          <td><span class="arrow-indicator">▶</span>${title}</td>
          ${cells}
        </tr>
      `;
    }

    const sortedOpCategories = Array.from(operationalExpenseCategories).sort();

    let dreBodyHtml = '';
    dreBodyHtml += renderDreRowHtml('Receita Bruta', [], (d) => d.receitaBruta);
    dreBodyHtml += renderDreRowHtml('Impostos (Simples Nacional)', [], (d) => -d.impostos, true);
    dreBodyHtml += renderDreRowHtml('Receita Líquida', ['dre-result-row'], (d) => d.receitaLiquida);
    dreBodyHtml += renderDreRowHtml('Comissão Professores', [], (d) => -d.comissao, true);
    dreBodyHtml += renderDreRowHtml('Energia (Elétrica)', [], (d) => -d.energia, true);
    dreBodyHtml += renderDreRowHtml('Taxas de processamento', [], (d) => -d.taxasProcessamento, true);
    dreBodyHtml += renderDreRowHtml('Lucro Bruto', ['dre-result-row'], (d) => d.lucroBruto);
    dreBodyHtml += renderDreCollapsibleHeaderRowHtml('Despesas Operacionais', 'dre-op-child-row', (d) => -d.despesasOperacionais);
    
    sortedOpCategories.forEach(cat => {
      dreBodyHtml += renderDreRowHtml(cat, ['dre-child-row', 'dre-op-child-row'], (d) => {
        const catVal = d.despesasOperacionaisCategories[cat] || 0.0;
        return -catVal;
      }, true);
    });

    dreBodyHtml += renderDreRowHtml('EBITDA', ['dre-result-row'], (d) => d.ebitda);
    dreBodyHtml += renderDreRowHtml('Depreciação (Quadra)', [], (d) => -d.depreciacao, true);
    dreBodyHtml += renderDreRowHtml('EBIT', ['dre-result-row'], (d) => d.ebit);
    dreBodyHtml += renderDreRowHtml('Imposto de Renda (IR)', [], (d) => -d.ir, true);
    dreBodyHtml += renderDreRowHtml('Lucro Líquido', ['dre-result-row'], (d) => d.lucroLiquido, true, true);

    const dreBody = document.getElementById('fin-dre-body');
    if (dreBody) {
      dreBody.innerHTML = dreBodyHtml;
    }

    // 6. Register collapse event handlers for both DFC and DRE
    document.querySelectorAll('#fin-dfc-table .flow-header-row').forEach(row => {
      row.addEventListener('click', () => {
        const targetClass = row.getAttribute('data-target');
        const isCollapsed = row.classList.toggle('collapsed');
        document.querySelectorAll('#fin-dfc-table .' + targetClass).forEach(child => {
          child.style.display = isCollapsed ? 'none' : '';
        });
        const arrow = row.querySelector('.arrow-indicator');
        if (arrow) {
          arrow.innerText = isCollapsed ? '▶' : '▼';
        }
      });
    });

    document.querySelectorAll('#fin-dre-table .flow-header-row').forEach(row => {
      row.addEventListener('click', () => {
        const targetClass = row.getAttribute('data-target');
        const isCollapsed = row.classList.toggle('collapsed');
        document.querySelectorAll('#fin-dre-table .' + targetClass).forEach(child => {
          child.style.display = isCollapsed ? 'none' : '';
        });
        const arrow = row.querySelector('.arrow-indicator');
        if (arrow) {
          arrow.innerText = isCollapsed ? '▶' : '▼';
        }
      });
    });

    // 7. Render Audit Transaction List
    renderAuditTransactions(currentProcfy, currentInter);

    // 8. Update ROI Analysis
    updateRoiAnalysis(dreData, currentMonthKey, historicMonths);

    // Save to global cache for projection
    cachedFinancialData = {
      allProcfyData,
      allInterData,
      allSalesData,
      allCommData,
      allPaymentMethodsData,
      allMpPaymentsData,
      monthStart,
      monthEnd,
      year,
      month,
      historicMonths,
      monthlyData,
      dreData
    };

    // Calculate and render projection
    calculateAndRenderProjection();

  } catch (err) {
    debugError('Erro ao carregar relatórios financeiros', err);
  }
}

// ---- Category Table Renderer ----
function renderCategoryTable(containerId, cats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = Object.entries(cats);
  if (entries.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="empty-state">Sem lançamentos para este fluxo.</td></tr>`;
    return;
  }

  // Sort categories alphabetically
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  let totalInflows = 0;
  let totalOutflows = 0;

  let html = entries.map(([catName, data]) => {
    const net = data.inflows - data.outflows;
    totalInflows += data.inflows;
    totalOutflows += data.outflows;
    
    let netClass = '';
    if (net > 0) netClass = 'text-inflow';
    if (net < 0) netClass = 'text-outflow';

    return `
      <tr>
        <td>${catName}</td>
        <td class="text-right font-semibold">${data.inflows > 0 ? formatCurrency(data.inflows) : '--'}</td>
        <td class="text-right font-semibold">${data.outflows > 0 ? formatCurrency(data.outflows) : '--'}</td>
        <td class="text-right ${netClass}">${formatCurrency(net)}</td>
      </tr>
    `;
  }).join('');

  const totalNet = totalInflows - totalOutflows;
  let totalNetClass = '';
  if (totalNet > 0) totalNetClass = 'text-inflow';
  if (totalNet < 0) totalNetClass = 'text-outflow';

  html += `
    <tr style="border-top: 2px solid var(--border); font-weight: 800;">
      <td>TOTAL</td>
      <td class="text-right">${totalInflows > 0 ? formatCurrency(totalInflows) : '--'}</td>
      <td class="text-right">${totalOutflows > 0 ? formatCurrency(totalOutflows) : '--'}</td>
      <td class="text-right ${totalNetClass}">${formatCurrency(totalNet)}</td>
    </tr>
  `;

  container.innerHTML = html;
}

// ---- Audit Transactions Renderer ----
function renderAuditTransactions(procfy, inter) {
  const container = document.getElementById('fin-transactions-rows');
  if (!container) return;

  const list = [];

  // Add Procfy paid transactions
  procfy.forEach(tx => {
    if (!tx.paid) return;
    const val = parseFloat(tx.amount) || 0;
    const isRev = tx.transaction_type === 'revenue';
    list.push({
      date: tx.due_date || '',
      name: tx.name || 'Sem nome',
      category: tx.category_name || 'Sem Categoria',
      flow: tx.cost_center_descricao || 'Outros',
      value: isRev ? val : -val
    });
  });

  // Add Inter CDB resgates
  inter.forEach(tx => {
    const desc = (tx.descricao || '').toLowerCase();
    const title = (tx.titulo || '').toLowerCase();
    const isResgate = desc.includes('resgate') || desc.includes('cdb') || title.includes('resgate');
    if (isResgate) {
      const val = Math.abs(parseFloat(tx.valor_com_sinal)) || 0;
      list.push({
        date: tx.data_movimento || '',
        name: tx.descricao || tx.titulo || 'Resgate CDB',
        category: 'Resgate de Aplicação Financeira (CDB)',
        flow: 'Investimentos',
        value: val
      });
    }
  });

  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum lançamento para este período.</td></tr>`;
    return;
  }

  // Sort by date desc, then by value absolute desc
  list.sort((a, b) => {
    const d1 = a.date.split('T')[0];
    const d2 = b.date.split('T')[0];
    if (d1 !== d2) return d2.localeCompare(d1);
    return Math.abs(b.value) - Math.abs(a.value);
  });

  container.innerHTML = list.map(item => {
    let valClass = '';
    let valText = formatCurrency(item.value);
    if (item.value > 0) {
      valClass = 'text-inflow';
      valText = '+' + valText;
    } else if (item.value < 0) {
      valClass = 'text-outflow';
    }
    
    let flowColor = 'var(--text-muted)';
    if (item.flow === 'Operação') flowColor = 'var(--color-saibro)';
    else if (item.flow === 'Investimentos') flowColor = '#2a9d8f';
    else if (item.flow === 'Sócios') flowColor = '#e9c46a';

    return `
      <tr>
        <td>${formatDateBR(item.date)}</td>
        <td class="font-semibold">${item.name}</td>
        <td><span class="period-badge secondary" style="font-size:0.7rem;">${item.category}</span></td>
        <td><span class="period-badge" style="background:transparent; border-color:${flowColor}; color:${flowColor}; font-size:0.7rem;">${item.flow}</span></td>
        <td class="text-right ${valClass}">${valText}</td>
      </tr>
    `;
  }).join('');
}

// ---- Historical Cash Flow Chart Renderer ----
function renderChartCashFlowHistory(labels, fco, fci, fcs, balances) {
  destroyChart('cashflowHistory');
  const canvas = document.getElementById('chart-cashflow-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  chartInstances['cashflowHistory'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'FCO (Operação)',
          data: fco,
          backgroundColor: '#C05131',
          stack: 'flows'
        },
        {
          label: 'FCI (Investimentos)',
          data: fci,
          backgroundColor: '#2a9d8f',
          stack: 'flows'
        },
        {
          label: 'FCS (Sócios)',
          data: fcs,
          backgroundColor: '#e9c46a',
          stack: 'flows'
        },
        {
          label: 'Saldo Final (Caixa)',
          data: balances,
          type: 'line',
          borderColor: '#f1f4e0',
          backgroundColor: '#f1f4e0',
          borderWidth: 2.5,
          tension: 0.35,
          yAxisID: 'y1',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'rgba(241, 244, 224, 0.8)', font: { family: 'Hanken Grotesk', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: context => {
              const val = context.raw || 0;
              return ` ${context.dataset.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: { color: 'rgba(241, 244, 224, 0.7)', font: { family: 'Hanken Grotesk' } }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(241, 244, 224, 0.05)' },
          ticks: {
            color: 'rgba(241, 244, 224, 0.7)',
            font: { family: 'Hanken Grotesk' },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR')
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: 'rgba(241, 244, 224, 0.7)',
            font: { family: 'Hanken Grotesk' },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR')
          }
        }
      }
    }
  });
}

if (mainTabCommissions && mainTabOperational && mainTabFinancial) {
  mainTabCommissions.addEventListener('click', () => {
    currentMainTab = 'commissions';
    mainTabCommissions.classList.add('active');
    mainTabOperational.classList.remove('active');
    mainTabFinancial.classList.remove('active');
    if (sectionCommissions) sectionCommissions.style.display = 'block';
    if (sectionOperational) sectionOperational.style.display = 'none';
    if (sectionFinancial) sectionFinancial.style.display = 'none';

    // Restore page title for commissions
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.innerText = 'Controle Financeiro';

    // Enable professor filter and commission rate
    if (selectProf) {
      const g = selectProf.closest('.control-group');
      if (g) { g.style.display = ''; g.style.opacity = '1'; g.style.pointerEvents = 'auto'; }
    }
    if (inputCommission) {
      const g = inputCommission.closest('.control-group');
      if (g) { g.style.display = ''; g.style.opacity = '1'; g.style.pointerEvents = 'auto'; }
    }
    if (btnPrint) btnPrint.style.display = 'inline-flex';

    loadDashboard();
  });

  mainTabOperational.addEventListener('click', () => {
    currentMainTab = 'operational';
    mainTabOperational.classList.add('active');
    mainTabCommissions.classList.remove('active');
    mainTabFinancial.classList.remove('active');
    if (sectionCommissions) sectionCommissions.style.display = 'none';
    if (sectionOperational) sectionOperational.style.display = 'block';
    if (sectionFinancial) sectionFinancial.style.display = 'none';

    // Update page title and subtitle for operational context
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.innerText = 'Relatórios Operacionais';
    const pageSubtitle = document.getElementById('dashboard-subtitle');
    if (pageSubtitle) {
      const year = selectYear.value;
      const month = selectMonth.value;
      const monthStart = `${year}-${month}-01`;
      pageSubtitle.innerText = `Dados operacionais consolidados — ${getMonthNameBR(monthStart)}`;
    }

    // Hide professor filter and commission rate
    if (selectProf) {
      const g = selectProf.closest('.control-group');
      if (g) { g.style.display = 'none'; }
    }
    if (inputCommission) {
      const g = inputCommission.closest('.control-group');
      if (g) { g.style.display = 'none'; }
    }
    if (btnPrint) btnPrint.style.display = 'none';

    loadOperationalReports();
  });

  mainTabFinancial.addEventListener('click', () => {
    currentMainTab = 'financial';
    mainTabFinancial.classList.add('active');
    mainTabCommissions.classList.remove('active');
    mainTabOperational.classList.remove('active');
    if (sectionCommissions) sectionCommissions.style.display = 'none';
    if (sectionOperational) sectionOperational.style.display = 'none';
    if (sectionFinancial) sectionFinancial.style.display = 'block';

    // Update page title and subtitle for financial context
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.innerText = 'Relatórios Financeiros';
    const pageSubtitle = document.getElementById('dashboard-subtitle');
    if (pageSubtitle) {
      const year = selectYear.value;
      const month = selectMonth.value;
      const monthStart = `${year}-${month}-01`;
      pageSubtitle.innerText = `Fluxo de Caixa Consolidado — ${getMonthNameBR(monthStart)}`;
    }

    // Hide professor filter and commission rate
    if (selectProf) {
      const g = selectProf.closest('.control-group');
      if (g) { g.style.display = 'none'; }
    }
    if (inputCommission) {
      const g = inputCommission.closest('.control-group');
      if (g) { g.style.display = 'none'; }
    }
    if (btnPrint) btnPrint.style.display = 'none';

    loadFinancialReports();
  });
}

// ---- Tab Event Listeners (Paid vs Pending) ----
if (tabPaid && tabPending) {
  tabPaid.addEventListener('click', () => {
    currentTab = 'paid';
    tabPaid.classList.add('active');
    tabPending.classList.remove('active');
    renderDashboardUI();
  });

  tabPending.addEventListener('click', () => {
    currentTab = 'pending';
    tabPending.classList.add('active');
    tabPaid.classList.remove('active');
    renderDashboardUI();
  });
}

// ---- Financial Sub-Tab Event Listeners (DFC vs DRE vs ROI vs Projection) ----
const btnShowDfc = document.getElementById('btn-show-dfc');
const btnShowDre = document.getElementById('btn-show-dre');
const btnShowRoi = document.getElementById('btn-show-roi');
const btnShowProjection = document.getElementById('btn-show-projection');
const cardDfc = document.getElementById('fin-dfc-card');
const cardDre = document.getElementById('fin-dre-card');
const cardRoi = document.getElementById('fin-roi-card');
const cardProjection = document.getElementById('fin-projection-card');

if (btnShowDfc && btnShowDre && btnShowRoi && btnShowProjection && cardDfc && cardDre && cardRoi && cardProjection) {
  btnShowDfc.addEventListener('click', () => {
    btnShowDfc.classList.add('active');
    btnShowDre.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjection.classList.remove('active');
    cardDfc.style.display = 'block';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection');
    }
  });

  btnShowDre.addEventListener('click', () => {
    btnShowDre.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjection.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'block';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-dre');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection');
    }
  });

  btnShowRoi.addEventListener('click', () => {
    btnShowRoi.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowDre.classList.remove('active');
    btnShowProjection.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'block';
    cardProjection.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-roi');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-projection');
    }
    
    // Recalculate and render ROI data
    calculateAndRenderRoi();
  });

  btnShowProjection.addEventListener('click', () => {
    btnShowProjection.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowDre.classList.remove('active');
    btnShowRoi.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'block';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-projection');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-roi');
    }
    
    // Recalculate and render Projection data
    calculateAndRenderProjection();
  });

  // Attach ROI interactive listeners
  const roiInvestment = document.getElementById('roi-input-investment');
  const roiMetric = document.getElementById('roi-select-metric');
  if (roiInvestment) roiInvestment.addEventListener('input', calculateAndRenderRoi);
  if (roiMetric) roiMetric.addEventListener('change', calculateAndRenderRoi);

  // Attach Projection interactive listeners
  const projGrowth = document.getElementById('proj-input-growth');
  const projCommission = document.getElementById('proj-input-commission');
  const projSafety = document.getElementById('proj-input-safety');
  if (projGrowth) {
    projGrowth.addEventListener('input', calculateAndRenderProjection);
    projGrowth.addEventListener('change', calculateAndRenderProjection);
  }
  if (projCommission) {
    projCommission.addEventListener('input', calculateAndRenderProjection);
    projCommission.addEventListener('change', calculateAndRenderProjection);
  }
  if (projSafety) {
    projSafety.addEventListener('input', calculateAndRenderProjection);
    projSafety.addEventListener('change', calculateAndRenderProjection);
  }
}

// ---- Combined Filter Change Handler ----
async function handleFilterChange() {
  if (currentMainTab === 'commissions') {
    await loadDashboard();
  } else if (currentMainTab === 'operational') {
    await loadOperationalReports();
  } else {
    await loadFinancialReports();
  }
}

// ---- Event Listeners ----
selectProf.addEventListener('change', handleFilterChange);
selectYear.addEventListener('change', handleFilterChange);
selectMonth.addEventListener('change', handleFilterChange);

// Toggle transactions detail section collapse/expand
const btnToggleTransactions = document.getElementById('btn-toggle-transactions');
const transactionsCardContainer = document.getElementById('transactions-card-container');
const transactionsArrow = document.getElementById('transactions-arrow-indicator');

if (btnToggleTransactions && transactionsCardContainer && transactionsArrow) {
  btnToggleTransactions.addEventListener('click', () => {
    const isHidden = transactionsCardContainer.style.display === 'none';
    if (isHidden) {
      transactionsCardContainer.style.display = 'block';
      transactionsArrow.innerText = '▼';
    } else {
      transactionsCardContainer.style.display = 'none';
      transactionsArrow.innerText = '▶';
    }
  });
}

// ---- Initial Load ----
async function initApp() {
  debugLog('App JS inicializado. Usando REST API direta com autenticação.');
  if (checkSession()) {
    await populateProfessors();
  }
  await handleFilterChange();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ---- Mobile Menu Logic ----
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const btnCloseMenu = document.getElementById('btn-close-menu');
const navControls = document.querySelector('.nav-controls');

if (btnMobileMenu && navControls) {
  btnMobileMenu.addEventListener('click', () => {
    navControls.classList.add('active');
  });
}

if (btnCloseMenu && navControls) {
  btnCloseMenu.addEventListener('click', () => {
    navControls.classList.remove('active');
  });
}

// Auto-close menu drawer when selecting options or performing actions
if (navControls) {
  const closeTriggers = navControls.querySelectorAll('select, input, button:not(#btn-close-menu)');
  closeTriggers.forEach(trigger => {
    const eventType = trigger.tagName === 'SELECT' || trigger.type === 'range' ? 'change' : 'click';
    trigger.addEventListener(eventType, () => {
      navControls.classList.remove('active');
    });
  });
}

// ---- Cash Flow Projection Calculations and Rendering ----
function calculateAndRenderProjection() {
  if (!cachedFinancialData) {
    debugLog("Sem dados financeiros cacheados para a projeção.");
    return;
  }

  const {
    allProcfyData,
    allInterData,
    allSalesData,
    allCommData,
    allPaymentMethodsData,
    allMpPaymentsData,
    monthStart,
    monthEnd,
    year,
    month,
    monthlyData,
    dreData
  } = cachedFinancialData;

  const elGrowth = document.getElementById('proj-input-growth');
  const elCommission = document.getElementById('proj-input-commission');
  const elSafety = document.getElementById('proj-input-safety');

  const growthRate = elGrowth ? parseFloat(elGrowth.value) / 100 : 0.0;
  const commissionRate = elCommission ? parseFloat(elCommission.value) / 100 : 0.47;
  const safetyRate = elSafety ? parseFloat(elSafety.value) / 100 : 0.0;

  const targetMonths = [
    { key: '2026-07', label: 'Julho/2026', monthStart: '2026-07-01', monthEnd: '2026-07-31' },
    { key: '2026-08', label: 'Agosto/2026', monthStart: '2026-08-01', monthEnd: '2026-08-31' },
    { key: '2026-09', label: 'Setembro/2026', monthStart: '2026-09-01', monthEnd: '2026-09-30' }
  ];

  const round2 = val => Math.round(val * 100) / 100;
  
  // Filter June bookings
  const juneBookings = allCommData.filter(row => row.booking_date && row.booking_date.startsWith('2026-06'));
  
  // Identify payment methods for each student customer_code from allPaymentMethodsData
  const studentPaymentTypes = {}; 
  const studentMethods = {}; 
  
  allPaymentMethodsData.forEach(p => {
    if (!p.customer_code) return;
    const method = (p.pay_method || '').toLowerCase();
    const isD30 = method.includes('credito') || method.includes('crédito') || method === 'tarjeta';
    if (!studentMethods[p.customer_code]) {
      studentMethods[p.customer_code] = { d0Count: 0, d30Count: 0 };
    }
    if (isD30) {
      studentMethods[p.customer_code].d30Count++;
    } else {
      studentMethods[p.customer_code].d0Count++;
    }
  });
  
  Object.keys(studentMethods).forEach(cc => {
    const counts = studentMethods[cc];
    studentPaymentTypes[cc] = counts.d30Count >= counts.d0Count ? 'D-30' : 'D-0';
  });

  // Calculate student slot values in June
  const juneUnpaidByStudent = {};
  
  juneBookings.forEach(b => {
    const studentName = b.participant_name || 'Desconhecido';
    if (!b.is_paid) {
      if (!juneUnpaidByStudent[studentName]) {
        juneUnpaidByStudent[studentName] = [];
      }
      juneUnpaidByStudent[studentName].push(b);
    }
  });
  
  const juneUnpaidEstimatedValues = {};
  
  Object.keys(juneUnpaidByStudent).forEach(studentName => {
    const bookings = juneUnpaidByStudent[studentName];
    const slots = {};
    bookings.forEach(b => {
      const dateObj = new Date(b.booking_date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const startTime = b.start_time || '00:00';
      const pricingInfo = getBasePriceForBooking(b);
      const slotKey = `${dayOfWeek}_${startTime}_${pricingInfo.category}`;
      if (!slots[slotKey]) {
        slots[slotKey] = { dayOfWeek, startTime, pricingInfo, bookings: [] };
      }
      slots[slotKey].bookings.push(b);
    });
    
    const uniqueSlotsList = Object.values(slots);
    const frequency = uniqueSlotsList.length;
    let freqDiscountRate = 0;
    if (frequency === 2) freqDiscountRate = 0.05;
    else if (frequency >= 3) freqDiscountRate = 0.07;
    
    uniqueSlotsList.forEach(slot => {
      const pricing = slot.pricingInfo;
      const nBookings = slot.bookings.length;
      const isOffPeak = slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5 && 
                        (parseInt(slot.startTime.split(':')[0], 10) >= 10 && parseInt(slot.startTime.split(':')[0], 10) <= 15);
      
      let slotProRataValue = 0;
      if (pricing.isMonthly) {
        const nTotal = getWeekdayOccurrencesInMonth('2026', '06', slot.dayOfWeek);
        slotProRataValue = (nBookings / nTotal) * pricing.price;
      } else {
        slotProRataValue = nBookings * pricing.price;
      }
      
      let slotFinalValue = 0;
      if (isOffPeak) {
        slotFinalValue = slotProRataValue * 0.88;
      } else {
        slotFinalValue = slotProRataValue * (1 - freqDiscountRate);
      }
      
      const perBookingValue = slotFinalValue / nBookings;
      slot.bookings.forEach(b => {
        juneUnpaidEstimatedValues[b.booking_id] = perBookingValue;
      });
    });
  });
  
  const activeJuneSlots = [];
  const slotGroups = {};
  
  juneBookings.forEach(b => {
    const studentName = b.participant_name || 'Desconhecido';
    const dateObj = new Date(b.booking_date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const startTime = b.start_time || '00:00';
    const slotKey = `${studentName}_${dayOfWeek}_${startTime}`;
    
    let val = 0;
    if (b.is_paid) {
      val = parseFloat(b.booking_value) || 0.0;
    } else {
      val = juneUnpaidEstimatedValues[b.booking_id] || 0.0;
    }
    
    if (!slotGroups[slotKey]) {
      slotGroups[slotKey] = {
        studentName,
        customerCode: b.customer_code,
        dayOfWeek,
        startTime,
        values: [],
        paymentType: studentPaymentTypes[b.customer_code] || 'D-30',
        isPaid: b.is_paid
      };
    }
    if (val > 0) {
      slotGroups[slotKey].values.push(val);
    }
  });
  
  Object.values(slotGroups).forEach(g => {
    const avgVal = g.values.length > 0 ? g.values.reduce((s, v) => s + v, 0) / g.values.length : 0.0;
    if (avgVal > 0) {
      activeJuneSlots.push({
        studentName: g.studentName,
        customerCode: g.customerCode,
        dayOfWeek: g.dayOfWeek,
        startTime: g.startTime,
        unitPrice: avgVal,
        paymentType: g.paymentType
      });
    }
  });

  const junePaidFinal = (monthlyData['2026-06'] && monthlyData['2026-06'].final) || 7280.98;

  let juneRemainingUnpaidInflowsD0 = 0.0;
  let juneRemainingUnpaidInflowsD30 = 0.0; 
  
  juneBookings.forEach(b => {
    if (b.is_paid) return;
    let val = juneUnpaidEstimatedValues[b.booking_id] || 0.0;
    const paymentType = studentPaymentTypes[b.customer_code] || 'D-30';
    if (paymentType === 'D-0') {
      juneRemainingUnpaidInflowsD0 += val;
    } else {
      juneRemainingUnpaidInflowsD30 += val;
    }
  });

  let juneRemainingUnpaidOutflows = 0.0;
  let juneRemainingUnpaidInflowsProcfy = 0.0;
  
  allProcfyData.forEach(tx => {
    const dateStr = tx.due_date;
    if (!dateStr || !dateStr.startsWith('2026-06')) return;
    if (tx.paid) return;
    
    const amount = parseFloat(tx.amount) || 0.0;
    if (tx.transaction_type === 'revenue') {
      juneRemainingUnpaidInflowsProcfy += amount;
    } else {
      juneRemainingUnpaidOutflows += amount;
    }
  });

  const julyOpeningBalance = junePaidFinal + juneRemainingUnpaidInflowsD0 + juneRemainingUnpaidInflowsProcfy - juneRemainingUnpaidOutflows;
  
  const juneSalesTotal = allSalesData.filter(s => s.pay_date && s.pay_date.startsWith('2026-06'))
                                     .reduce((sum, s) => sum + (parseFloat(s.valor_faturamento) || 0.0), 0.0);
  const junePaidTuition = juneBookings.filter(b => b.is_paid)
                                      .reduce((sum, b) => sum + (parseFloat(b.booking_value) || 0.0), 0.0);
  const juneVariableRevenueBaseline = Math.max(0.0, juneSalesTotal - junePaidTuition);

  const juneFixedExpensesBaseline = (dreData['2026-06'] ? dreData['2026-06'].energia : 0.0) +
                                    (dreData['2026-06'] ? dreData['2026-06'].despesasOperacionais : 0.0);

  const projectionResults = {};
  
  const rollingVariableRevenues = [juneVariableRevenueBaseline];
  const rollingFixedExpenses = [juneFixedExpensesBaseline];

  const juneD30TuitionTotal = juneBookings.map(b => {
    const paymentType = studentPaymentTypes[b.customer_code] || 'D-30';
    if (paymentType === 'D-30') {
      return b.is_paid ? (parseFloat(b.booking_value) || 0.0) : (juneUnpaidEstimatedValues[b.booking_id] || 0.0);
    }
    return 0.0;
  }).reduce((sum, val) => sum + val, 0.0);

  let prevD30Tuition = juneD30TuitionTotal;
  let prevD30Variable = juneVariableRevenueBaseline * 0.70; 

  let prevMonthFinalBalance = julyOpeningBalance;

  targetMonths.forEach((m, idx) => {
    const mKey = m.key;
    const curYearStr = mKey.substring(0, 4);
    const curMonthStr = mKey.substring(5, 7);

    let tuitionGenerated = 0.0;
    let tuitionD0 = 0.0;
    let tuitionD30 = 0.0;

    activeJuneSlots.forEach(slot => {
      const occurrences = getWeekdayOccurrencesInMonth(curYearStr, curMonthStr, slot.dayOfWeek);
      const slotVal = occurrences * slot.unitPrice;
      tuitionGenerated += slotVal;
      if (slot.paymentType === 'D-0') {
        tuitionD0 += slotVal;
      } else {
        tuitionD30 += slotVal;
      }
    });

    tuitionGenerated = round2(tuitionGenerated * (1 + growthRate));
    tuitionD0 = round2(tuitionD0 * (1 + growthRate));
    tuitionD30 = round2(tuitionD30 * (1 + growthRate));

    const avgVarRevenue = rollingVariableRevenues.reduce((s, v) => s + v, 0) / rollingVariableRevenues.length;
    let projectedVarRevenue = round2(avgVarRevenue * (1 + growthRate));
    rollingVariableRevenues.push(projectedVarRevenue);

    let varD0 = round2(projectedVarRevenue * 0.30);
    let varD30 = round2(projectedVarRevenue * 0.70);

    const tuitionReceivedD0 = tuitionD0;
    const tuitionReceivedD30 = prevD30Tuition;

    const variableReceivedD0 = varD0;
    const variableReceivedD30 = prevD30Variable;

    const totalInflow = round2(tuitionReceivedD0 + tuitionReceivedD30 + variableReceivedD0 + variableReceivedD30);

    prevD30Tuition = tuitionD30;
    prevD30Variable = varD30;

    const procfyScheduled = allProcfyData.filter(tx => {
      const dateStr = tx.due_date;
      return dateStr && dateStr.startsWith(mKey) && !tx.paid && tx.transaction_type !== 'revenue';
    }).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

    const procfyScheduledRounded = round2(procfyScheduled);

    const avgFixedExpenses = rollingFixedExpenses.reduce((s, v) => s + v, 0) / rollingFixedExpenses.length;
    
    const baseProvision = Math.max(0.0, avgFixedExpenses - procfyScheduledRounded);
    const safetyProvision = (procfyScheduledRounded + baseProvision) * safetyRate;
    const totalFixedProvision = round2(baseProvision + safetyProvision);

    const totalMonthFixedExpenses = procfyScheduledRounded + totalFixedProvision;
    rollingFixedExpenses.push(totalMonthFixedExpenses);

    const commissionPaid = round2(tuitionGenerated * commissionRate);

    let tuitionFees = 0.0;
    tuitionFees += tuitionReceivedD30 * 0.0193;

    activeJuneSlots.forEach(slot => {
      if (slot.paymentType === 'D-0') {
        const occurrences = getWeekdayOccurrencesInMonth(curYearStr, curMonthStr, slot.dayOfWeek);
        const slotVal = round2(occurrences * slot.unitPrice * (1 + growthRate));
        
        const payments = allPaymentMethodsData.filter(p => p.customer_code === slot.customerCode);
        const isDebit = payments.some(p => (p.pay_method || '').toLowerCase() === 'cartão débito');
        
        if (isDebit) {
          tuitionFees += slotVal * 0.0099;
        }
      }
    });

    const variableFees = (variableReceivedD30 * 0.0193);

    const totalFees = round2(tuitionFees + variableFees);

    const totalOutflow = round2(procfyScheduledRounded + totalFixedProvision + commissionPaid + totalFees);

    const netFlow = round2(totalInflow - totalOutflow);
    const finalBalance = round2(prevMonthFinalBalance + netFlow);

    projectionResults[mKey] = {
      initialBalance: prevMonthFinalBalance,
      tuitionReceivedD0,
      tuitionReceivedD30,
      variableReceivedD0,
      variableReceivedD30,
      totalInflow,
      procfyScheduled: procfyScheduledRounded,
      fixedProvision: totalFixedProvision,
      commissionPaid,
      processingFees: totalFees,
      totalOutflow,
      netFlow,
      finalBalance
    };

    prevMonthFinalBalance = finalBalance;
  });

  const headerRow = document.getElementById('fin-projection-header-row');
  if (headerRow) {
    headerRow.innerHTML = `<th>Categoria / Conta</th>` + targetMonths.map(m => `<th class="text-right">${m.label} (Projetado)</th>`).join('');
  }

  function makeProjRowHtml(title, rowClasses, dataGetter, isNegativeRed = false, isPositiveGreen = false) {
    const cells = targetMonths.map(m => {
      const val = dataGetter(projectionResults[m.key]);
      let valClass = '';
      if (isNegativeRed && val < 0) valClass = 'text-outflow';
      else if (isPositiveGreen && val > 0) valClass = 'text-inflow';
      
      const formatted = formatCurrency(Math.abs(val));
      const signedFormatted = val < 0 ? `-${formatted}` : formatted;
      
      return `<td class="text-right ${valClass}">${signedFormatted}</td>`;
    }).join('');
    
    const classAttr = rowClasses && rowClasses.length ? `class="${rowClasses.join(' ')}"` : '';
    return `<tr ${classAttr}><td>${title}</td>${cells}</tr>`;
  }

  let html = '';
  html += makeProjRowHtml('Saldo Inicial (Caixa)', ['dfc-balance-row'], r => r.initialBalance);
  
  html += `<tr class="flow-header-row collapsed"><td><span class="arrow-indicator">▼</span>(+) Entradas de Caixa</td>` + 
          targetMonths.map(m => `<td class="text-right text-inflow">${formatCurrency(projectionResults[m.key].totalInflow)}</td>`).join('') + `</tr>`;
  
  html += makeProjRowHtml('Mensalidades (Recebimento D-0)', ['fco-child-row'], r => r.tuitionReceivedD0);
  html += makeProjRowHtml('Mensalidades (Recebimento D-30)', ['fco-child-row'], r => r.tuitionReceivedD30);
  html += makeProjRowHtml('Locações e Outros (Recebimento D-0)', ['fco-child-row'], r => r.variableReceivedD0);
  html += makeProjRowHtml('Locações e Outros (Recebimento D-30)', ['fco-child-row'], r => r.variableReceivedD30);

  html += `<tr class="flow-header-row collapsed"><td><span class="arrow-indicator">▼</span>(-) Saídas de Caixa</td>` + 
          targetMonths.map(m => `<td class="text-right text-outflow">-${formatCurrency(projectionResults[m.key].totalOutflow)}</td>`).join('') + `</tr>`;
  
  html += makeProjRowHtml('Despesas Agendadas (Procfy)', ['fco-child-row'], r => -r.procfyScheduled, true);
  html += makeProjRowHtml('Provisão de Custos Recorrentes', ['fco-child-row'], r => -r.fixedProvision, true);
  html += makeProjRowHtml('Comissões de Professores', ['fco-child-row'], r => -r.commissionPaid, true);
  html += makeProjRowHtml('Taxas de Processamento', ['fco-child-row'], r => -r.processingFees, true);

  html += makeProjRowHtml('(=) Fluxo Líquido do Mês', ['dfc-balance-row'], r => r.netFlow, false, true);
  html += makeProjRowHtml('Saldo Final (Caixa)', ['dfc-balance-row'], r => r.finalBalance);

  const tbody = document.getElementById('fin-projection-body');
  if (tbody) {
    tbody.innerHTML = html;
  }
}

