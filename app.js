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
      `select=customer_code&paid=eq.true&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}&is_canceled=eq.false`
    );

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
      `select=customer_code,pay_date&paid=eq.true&is_canceled=eq.false&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}`
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
        backgroundColor: ['#C05131', '#2a9d8f', '#e9c46a', '#f4a261', '#457b9d', '#9b5de5'],
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
const sectionCommissions = document.getElementById('section-commissions');
const sectionOperational = document.getElementById('section-operational');

if (mainTabCommissions && mainTabOperational) {
  mainTabCommissions.addEventListener('click', () => {
    currentMainTab = 'commissions';
    mainTabCommissions.classList.add('active');
    mainTabOperational.classList.remove('active');
    if (sectionCommissions) sectionCommissions.style.display = 'block';
    if (sectionOperational) sectionOperational.style.display = 'none';

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
    if (sectionCommissions) sectionCommissions.style.display = 'none';
    if (sectionOperational) sectionOperational.style.display = 'block';

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

    // Hide professor filter and commission rate — irrelevant for operational reports
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

// ---- Combined Filter Change Handler ----
async function handleFilterChange() {
  if (currentMainTab === 'commissions') {
    await loadDashboard();
  } else {
    await loadOperationalReports();
  }
}

// ---- Event Listeners ----
selectProf.addEventListener('change', handleFilterChange);
selectYear.addEventListener('change', handleFilterChange);
selectMonth.addEventListener('change', handleFilterChange);

// ---- Initial Load ----
debugLog('App JS inicializado. Usando REST API direta com autenticação.');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleFilterChange);
} else {
  handleFilterChange();
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

