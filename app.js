// ============================
// Montreal Tênis - Comissões Dashboard
// Direct REST API approach (no CDN dependency)
// ============================

const SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ';
const UNPAID_RECOVERY_RATE = 0.90; // 90% recovery rate / 10% delinquency rate for unpaid bookings

// Helper to get adjusted commission base (applies custom rules, e.g., Jaqueline Bordejaco off-peak discount)
function getAdjustedCommissionBase(row, baseValue) {
  let base = parseFloat(baseValue) || 0.0;
  const name = (row.participant_name || '').toLowerCase();
  const date = row.booking_date || '';
  if (name.includes('jaqueline') && name.includes('bordejaco')) {
    if (date >= '2026-07-01') {
      base = base * 0.88; // 12% discount for off-peak (15h-16h) from July 2026 onwards
    }
  }
  return base;
}

// Helper to get professor commission rate
function getRateForTeacher(profName) {
  return currentCommissionRate;
}

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

// ---- Investment Balance Calculator ----
function calculateInvestmentBalance(allInterData, upToDateStr = null) {
  const INITIAL_INVESTMENT_BALANCE = 111.79;
  const CUTOFF_DATE = '2026-07-01';
  let balance = INITIAL_INVESTMENT_BALANCE;
  
  if (!allInterData) return balance;
  
  allInterData.forEach(tx => {
    if (!tx.data_movimento || tx.data_movimento < CUTOFF_DATE) return;
    if (upToDateStr && tx.data_movimento > upToDateStr) return;
    
    const desc = (tx.descricao || '').toLowerCase();
    const title = (tx.titulo || '').toLowerCase();
    
    const isInvTx = tx.tipo_transacao_inter === 'INVESTIMENTO' ||
                    desc.includes('resgate') || desc.includes('cdb') || desc.includes('firf') || desc.includes('aplicação') || desc.includes('aplicacao') ||
                    title.includes('resgate') || title.includes('cdb') || title.includes('firf') || title.includes('aplicação') || title.includes('aplicacao');
                    
    if (isInvTx) {
      const valComSinal = parseFloat(tx.valor_com_sinal) || 0;
      const isCredit = valComSinal > 0 || tx.tipo_movimento === 'entrada';
      const amount = Math.abs(valComSinal);
      
      if (isCredit) {
        // Resgate: decreases investment account balance
        balance -= amount;
      } else {
        // Aplicação: increases investment account balance
        balance += amount;
      }
    }
  });
  
  return balance;
}

// ---- Supabase REST helpers ----
async function supabaseSelect(table, queryParams = '') {
  const hasLimit = queryParams.includes('limit=');
  const hasOffset = queryParams.includes('offset=');
  
  if (hasLimit || hasOffset) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
    debugLog(`[REST] GET ${url}`);
    const token = getUserToken() || SUPABASE_KEY;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase REST error ${res.status}: ${body}`);
    }
    return res.json();
  }

  let allData = [];
  let currentOffset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const separator = queryParams ? '&' : '';
    const paginatedParams = `${queryParams}${separator}limit=${limit}&offset=${currentOffset}`;
    const url = `${SUPABASE_URL}/rest/v1/${table}?${paginatedParams}`;
    debugLog(`[REST] GET ${url} (offset: ${currentOffset})`);
    
    const token = getUserToken() || SUPABASE_KEY;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase REST error ${res.status}: ${body}`);
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) {
      return data;
    }
    
    allData = allData.concat(data);
    
    if (data.length < limit) {
      hasMore = false;
    } else {
      currentOffset += limit;
    }
  }
  
  return allData;
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
let currentSalesData = [];
let currentVoucherData = []; // Vouchers de intensivão: [{customer_name, description, total, pay_date}]
let currentAllocationsData = [];
let cachedFinancialData = null;
let cachedMonthEndProjectionBalance = null; // final balance from daily projection → used as July opening in 3-month projection

// Caching variables for Monthly Report PDF generation
let cachedMonthsLabels = [];
let cachedHistoricalRevenue = [];
let cachedHistoricalStudents = [];
let cachedOccupancyHistoryPct = [];
let cachedTicketMedioHistory = [];
let cachedProcessedSubData = [];
let cachedCourtData = [];
let cachedPayData = [];


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

// ---- Utility: normalize name for professor matching (remove accents, uppercase) ----
function normalizeNameForMatch(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// ---- Utility: parse intensivão voucher professor from sale description ----
// Pattern: "Voucher ... INTENSIVÃO - N aulas - PROFESSOR NAME"
function parseVoucherProfessor(description) {
  const match = (description || '').match(/INTENSIV\S*\s*-\s*\d+\s*aulas?\s*-\s*(.+)$/i);
  return match ? match[1].trim() : null;
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
    // 1. Calculate nextMonthStart first to use in classesParams
    const nextMonthStart = (() => {
      const d = new Date(monthStart + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0].substring(0, 8) + '01';
    })();

    // 2. Fetch classes that occurred in the month OR were paid in the month (including pay_date in selection)
    const classesParams = `select=*,pay_date&or=(and(booking_date.gte.${monthStart},booking_date.lte.${monthEnd}),and(pay_date.gte.${monthStart},pay_date.lt.${nextMonthStart}))`;
    debugLog('Buscando aulas globais via REST API...');

    // 3. Fetch payouts (for the selected professor)
    const profEncoded = encodeURIComponent(professor);
    const payoutsParams = `select=*&professor=eq.${profEncoded}&reference_period=eq.${monthStart}&order=payout_date.desc`;
    debugLog('Buscando repasses via REST API...');

    // 4. Fetch global sales data for faturamento reconciliation
    const salesParams = `select=valor_faturamento,categoria,subcategoria,item_description,pay_date&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}`;
    debugLog('Buscando vendas globais para conciliação...');

    const [classesData, payoutsData, salesData] = await Promise.all([
      supabaseSelect('vw_mt_comissoes_detalhadas', classesParams),
      supabaseSelect('mt_pagamentos_professores', payoutsParams),
      supabaseSelect('vw_mt_faturamento_itens_pago', salesParams)
    ]);

    // 5. Fetch intensivão vouchers directly from mt_faturamento_vendas
    //    (a descrição completa com nome do professor fica na venda, não no item)
    const voucherParams = `select=external_id,doc_number,description,total,pay_date,customer_name,customer_code&description=ilike.*INTENSIV*&paid=eq.true&is_canceled=eq.false&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}`;
    let rawVouchers = [];
    try {
      rawVouchers = await supabaseSelect('mt_faturamento_vendas', voucherParams);
    } catch(e) { debugError('Erro ao buscar vouchers intensivão', e); }
    // Filtra: apenas vouchers com professor identificado na descrição e valor positivo
    const voucherData = rawVouchers.filter(v => {
      const prof = parseVoucherProfessor(v.description || '');
      return prof && parseFloat(v.total) > 0 && !/anula/i.test(v.description || '');
    });
    debugLog(`Vouchers intensivão carregados: ${voucherData.length} válidos de ${rawVouchers.length} total.`);

    debugLog(`Aulas globais carregadas: ${classesData.length} linhas.`);
    debugLog(`Repasses carregados: ${payoutsData.length} linhas.`);
    debugLog(`Vendas globais carregadas: ${salesData.length} linhas.`);

    // Store in global cache for local recalculation
    currentClassesData = classesData;
    currentPayoutsData = payoutsData;
    currentSalesData = salesData; // Cache global sales
    currentVoucherData = voucherData; // Cache intensivão vouchers
    currentAllocationsData = []; // No client-level allocations needed anymore

    // Perform calculations and rendering locally
    calculateAndRenderDashboardData();

  } catch (err) {
    debugError('Erro ao buscar dados do Supabase', err);
    alert('Erro ao carregar os dados do dashboard. Verifique o console de diagnóstico no rodapé da página.');
  }
}

// ---- Calculate and Render Dashboard Data Locally (No network requests) ----
function calculateAndRenderDashboardData() {
  const allMonthlyClasses = currentClassesData;
  const payoutsData = currentPayoutsData;
  const salesData = currentSalesData || [];
  const professor = selectProf.value;
  const year = selectYear.value;
  const month = selectMonth.value;

  // Filter classes for the selected professor for the existing commission logic
  const classesData = allMonthlyClasses.filter(row => row.professor === professor);

  // Group bookings by student for pending calculations

  // Group bookings by student for pending calculations
  const pendingBookingsByStudent = {};
  const paidAgg = {};
  let totalPaidFaturamento = 0;
  let totalCommissionBase = 0;
  let period1PagoVal = 0;
  let period2PagoVal = 0;
  let period1CommissionBase = 0;
  let period2CommissionBase = 0;

  const baseMonthPrefix = `${year}-${month}`; // e.g., "2026-06"

  classesData.forEach(row => {
    const studentName = row.participant_name || 'Desconhecido';
    
    // Critério 1: Aula paga dentro do mês de referência do relatório
    const isPaidInSelectedMonth = row.is_paid && row.pay_date && row.pay_date.startsWith(baseMonthPrefix);
    
    // Critério 2: Aula agendada no mês de referência mas ainda não paga
    const isPendingInSelectedMonth = !row.is_paid && row.booking_date && row.booking_date.startsWith(baseMonthPrefix);

    if (isPaidInSelectedMonth) {
      const val = parseFloat(row.booking_value) || 0;
      const rawBase = parseFloat(row.booking_commission_base) || val;
      const commBase = getAdjustedCommissionBase(row, rawBase);
      const isSocio = row.is_socio_benefit || false;
      if (val > 0) {
        totalPaidFaturamento += val;
        totalCommissionBase += commBase;
        
        // Split periods by booking_date (when the class happened), not pay_date (when student paid)
        // This ensures 1st Period = commission on classes days 1-20, 2nd Period = days 21-30
        if (row.booking_date) {
          const day = parseInt(row.booking_date.split('-')[2], 10);
          if (day <= 20) {
            period1PagoVal += val;
            period1CommissionBase += commBase;
          } else {
            period2PagoVal += val;
            period2CommissionBase += commBase;
          }
        }
        
        if (!paidAgg[studentName]) {
          paidAgg[studentName] = { 
            name: studentName, 
            classesCount: 0, 
            totalBilled: 0, 
            totalCommissionBase: 0, 
            isSocio: false
          };
        }
        paidAgg[studentName].classesCount += 1;
        paidAgg[studentName].totalBilled += val;
        paidAgg[studentName].totalCommissionBase += commBase;
        if (isSocio) {
          paidAgg[studentName].isSocio = true;
        }
      }
    } else if (isPendingInSelectedMonth) {
      // Unpaid / Pending
      if (!pendingBookingsByStudent[studentName]) {
        pendingBookingsByStudent[studentName] = [];
      }
      pendingBookingsByStudent[studentName].push(row);
    }
  });

  // ---- Intensivão Vouchers: alocar ao professor selecionado ----
  // Usa currentVoucherData (fetch direto de mt_faturamento_vendas) — a descrição
  // completa com nome do professor fica na venda, não no item da view.
  const normalizedSelectedProf = normalizeNameForMatch(professor);
  (currentVoucherData || []).forEach(v => {
    const profInVoucher = parseVoucherProfessor(v.description || '');
    if (!profInVoucher) return;
    const normalizedVoucherProf = normalizeNameForMatch(profInVoucher);
    if (!normalizedSelectedProf || !normalizedVoucherProf) return;
    if (!normalizedSelectedProf.includes(normalizedVoucherProf) && !normalizedVoucherProf.includes(normalizedSelectedProf)) return;
    const val = parseFloat(v.total) || 0;
    if (val <= 0) return;

    totalPaidFaturamento += val;
    totalCommissionBase += val;

    // Split de período pelo dia do pay_date do voucher
    const payDateStr = (v.pay_date || '').split('T')[0];
    const vDay = payDateStr ? parseInt(payDateStr.split('-')[2], 10) : 1;
    if (vDay <= 20) {
      period1PagoVal += val;
      period1CommissionBase += val;
    } else {
      period2PagoVal += val;
      period2CommissionBase += val;
    }

    // Adiciona o aluno à tabela de pagos (para aparecer na listagem)
    const studentName = (v.customer_name || 'Voucher Intensivão') + ' 🎫';
    if (!paidAgg[studentName]) {
      paidAgg[studentName] = { name: studentName, classesCount: 0, totalBilled: 0, totalCommissionBase: 0, isSocio: false };
    }
    paidAgg[studentName].classesCount += 1;
    paidAgg[studentName].totalBilled += val;
    paidAgg[studentName].totalCommissionBase += val;

    debugLog(`[Voucher Intensivão] Cliente="${v.customer_name}" Prof="${profInVoucher}" Val=${val} Dia=${vDay}`);
  });

  studentsPaid = Object.values(paidAgg);

  // Now calculate estimations for pending students
  let totalPendingFaturamento = 0;
  let period1PendingVal = 0;
  let period2PendingVal = 0;
  let period1PendingCommissionBase = 0;
  let period2PendingCommissionBase = 0;
  studentsPending = [];

  Object.keys(pendingBookingsByStudent).forEach(studentName => {
    const bookings = pendingBookingsByStudent[studentName];
    
    // Group bookings by unique weekly slot to identify F (frequency)
    const slots = {};
    bookings.forEach(b => {
      const descUpper = (b.description || '').toUpperCase();
      const isFree = b.booking_type === 'clase_suelta' ||
                     descUpper.includes('REPOSIÇÃO') ||
                     descUpper.includes('REPOSICAO') ||
                     descUpper.includes('EXPERIMENTAL') ||
                     descUpper.includes('CORTESIA') ||
                     descUpper.includes('TESTE');
      
      if (isFree) {
        b.estimated_value = 0.0;
        return;
      }

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
        const rawBase = parseFloat(b.booking_commission_base) || (b.is_socio_benefit ? perBookingValue * 2 : perBookingValue);
        const commBase = getAdjustedCommissionBase(b, rawBase);
        if (day <= 20) {
          period1PendingVal += perBookingValue;
          period1PendingCommissionBase += commBase;
        } else {
          period2PendingVal += perBookingValue;
          period2PendingCommissionBase += commBase;
        }
      });

      studentTotalBilled += slotFinalValue;
    });

    totalPendingFaturamento += studentTotalBilled;

    let studentCommissionBase = 0;
    let isSocio = false;
    bookings.forEach(b => {
      if (b.is_socio_benefit) isSocio = true;
      const rawBase = parseFloat(b.booking_commission_base) || (b.is_socio_benefit ? (b.estimated_value * 2) : (b.estimated_value || 0));
      const commBase = getAdjustedCommissionBase(b, rawBase);
      studentCommissionBase += commBase;
    });

    if (studentCommissionBase === 0) {
      studentCommissionBase = studentTotalBilled;
    }

    studentsPending.push({
      name: studentName,
      classesCount: bookings.length,
      totalBilled: studentTotalBilled,
      totalCommissionBase: studentCommissionBase,
      isSocio: isSocio
    });
  });

  let totalPendingCommissionBase = 0;
  studentsPending.forEach(s => {
    totalPendingCommissionBase += s.totalCommissionBase;
  });

  const commissionGeneratedVal = totalCommissionBase * (currentCommissionRate / 100);
  const period1ComissaoVal = period1CommissionBase * (currentCommissionRate / 100);
  const period2ComissaoVal = period2CommissionBase * (currentCommissionRate / 100);

  const pendingCommissionVal = totalPendingCommissionBase * (currentCommissionRate / 100);
  const period1PendingComissaoVal = period1PendingCommissionBase * (currentCommissionRate / 100);
  const period2PendingComissaoVal = period2PendingCommissionBase * (currentCommissionRate / 100);

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

  // 3b. Populate reconciliation card and details
  const recComissao = document.getElementById('rec-comissao-total');
  const recRepasse  = document.getElementById('rec-repasse-pago');
  const recSaldo    = document.getElementById('rec-saldo-restante');
  if (recComissao) recComissao.innerText = formatCurrency(metricsPaid.comissao);
  if (recRepasse)  recRepasse.innerText  = formatCurrency(metricsPaid.repasse);
  if (recSaldo) {
    recSaldo.innerText = formatCurrency(metricsPaid.saldo);
    recSaldo.classList.toggle('zero', metricsPaid.saldo < 0.01);
  }



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

  // ---- Conciliação de Caixa Geral ----
  const _year = selectYear ? selectYear.value : '';
  const _month = selectMonth ? selectMonth.value : '';
  const baseMonthPrefix = `${_year}-${_month}`;
  const globalComissionableBase = currentClassesData.reduce((sum, row) => {
    const isPaidInSelectedMonth = row.is_paid && row.pay_date && row.pay_date.startsWith(baseMonthPrefix);
    return sum + (isPaidInSelectedMonth ? (parseFloat(row.booking_value) || 0) : 0);
  }, 0);

  let globalTotalCaixaVal = 0;
  let globalLocacoesVal = 0;
  let globalConsumosVal = 0;
  let globalVoucherComissionavel = 0; // Vouchers de intensivão com professor identificado

  const salesData = currentSalesData || [];
  salesData.forEach(row => {
    const val = parseFloat(row.valor_faturamento) || 0;
    globalTotalCaixaVal += val;

    const desc = (row.item_description || '').toLowerCase();
    const cat = (row.categoria || '').toLowerCase();
    const prod = (row.produto_padronizado || '').toLowerCase();

    // Voucher de intensivão: qualquer linha com "INTENSIV" vai para o bucket de voucher
    // (inclui emissões, anulações e reemissões — o líquido é o valor correto)
    const isIntensivao = /INTENSIV/i.test(row.item_description || '');
    if (isIntensivao) {
      const voucherProf = parseVoucherProfessor(row.item_description || '');
      if (voucherProf && val > 0) {
        globalVoucherComissionavel += val; // voucher com professor identificado → comissionável
      }
      // anulações e vouchers sem professor → ficam em globalVoucherComissionavel como 0
      // mas são retirados dos buckets de aula/locação/consumo (return abaixo)
      return;
    }

    const isLesson = cat === 'aulas' || desc.includes('tênis') || desc.includes('tenis') || desc.includes('aula') || desc.includes('kids') || desc.includes('baby') || prod.includes('tênis') || prod.includes('aula');
    const isRental = cat === 'locação' || desc.includes('locação') || desc.includes('reserva') || prod.includes('locação') || prod.includes('reserva');

    if (isLesson) {
      // Already handled by globalComissionableBase
    } else if (isRental) {
      globalLocacoesVal += val;
    } else {
      globalConsumosVal += val;
    }
  });

  const globalComissionableVal = globalComissionableBase + globalVoucherComissionavel;
  const globalAjustesVal = globalTotalCaixaVal - (globalComissionableVal + globalLocacoesVal + globalConsumosVal);
  debugLog(`[Conciliação] comissionableBase=${globalComissionableBase.toFixed(2)}, vouchers=${globalVoucherComissionavel.toFixed(2)}, total=${globalComissionableVal.toFixed(2)}, ajustes=${globalAjustesVal.toFixed(2)}`);

  // Update DOM elements for Global Cash Reconciliation Card
  const elGlobalComissionavel = document.getElementById('global-rec-comissionavel');
  const elGlobalLocacoes = document.getElementById('global-rec-locacoes');
  const elGlobalConsumos = document.getElementById('global-rec-consumos');
  const elGlobalAjustes = document.getElementById('global-rec-ajustes');
  const elGlobalTotalCaixa = document.getElementById('global-rec-total-caixa');
  
  if (elGlobalComissionavel) elGlobalComissionavel.innerText = formatCurrency(globalComissionableVal);
  if (elGlobalLocacoes) elGlobalLocacoes.innerText = formatCurrency(globalLocacoesVal);
  if (elGlobalConsumos) elGlobalConsumos.innerText = formatCurrency(globalConsumosVal);
  if (elGlobalAjustes) elGlobalAjustes.innerText = formatCurrency(globalAjustesVal);
  if (elGlobalTotalCaixa) elGlobalTotalCaixa.innerText = formatCurrency(globalTotalCaixaVal);

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
      ? `Comissão Gerada` 
      : `Comissão Prevista`;
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

  const normalStudents = students.filter(s => !s.isSocio);
  const socioStudents = students.filter(s => s.isSocio);
  let rowsHtml = '';

  if (normalStudents.length > 0) {
    if (socioStudents.length > 0) {
      rowsHtml += `
        <tr class="table-section-header print-section-header">
          <td colspan="4" style="background: rgba(255,255,255,0.02); font-weight: 700; color: var(--color-creme); padding: 8px 12px; border-bottom: 1px solid var(--border);">
            Alunos Regulares (Repasse sobre Valor Líquido)
          </td>
        </tr>
      `;
    }
    rowsHtml += normalStudents.map(s => {
      const studentComm = s.totalCommissionBase * (currentCommissionRate / 100);
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
  }

  if (socioStudents.length > 0) {
    rowsHtml += `
      <tr class="table-section-header print-section-header">
        <td colspan="4" style="background: rgba(16, 185, 129, 0.04); font-weight: 700; color: var(--color-receita); padding: 8px 12px; border-bottom: 1px solid rgba(16, 185, 129, 0.2); border-top: 1px solid var(--border);">
          Sócios Arena (Benefício 50% - Repasse sobre Valor Bruto)
        </td>
      </tr>
    `;
    rowsHtml += socioStudents.map(s => {
      const studentComm = s.totalCommissionBase * (currentCommissionRate / 100);
      totalClasses += s.classesCount;
      totalBilled += s.totalBilled;
      totalCommission += studentComm;
      const showBaseBruto = s.totalCommissionBase > s.totalBilled + 0.01;
      const baseBrutoHtml = showBaseBruto ? `
            <span class="bruto-subtext" style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 2px;">
              (Base Repasse Bruto: ${formatCurrency(s.totalCommissionBase)})
            </span>` : '';
      return `
        <tr class="socio-highlight-row" style="background: rgba(16, 185, 129, 0.015);">
          <td>
            ${s.name} 
            <span style="font-size: 0.65rem; background: rgba(16, 185, 129, 0.15); color: var(--color-receita); padding: 1px 6px; border-radius: 4px; font-weight: 800; margin-left: 6px; text-transform: uppercase; letter-spacing: 0.03em; vertical-align: middle;">
              Sócio
            </span>
          </td>
          <td class="text-center">${s.classesCount}</td>
          <td class="text-right">
            ${formatCurrency(s.totalBilled)}
            ${baseBrutoHtml}
          </td>
          <td class="text-right text-saibro font-semibold">${formatCurrency(studentComm)}</td>
        </tr>
      `;
    }).join('');
  }

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
    // Save payout parent row
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

      // Populate professors dynamically
      await populateProfessors();

      // Load data
      await loadDashboard();

      // Hide login screen
      loginOverlay.style.visibility = 'hidden';
      loginOverlay.style.opacity = '0';
      loginOverlay.style.display = 'none';

      // Clear form
      loginEmail.value = '';
      loginPassword.value = '';
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
    studentsTableRows.innerHTML = `<tr><td colspan="5" class="empty-state">Efetue login para visualizar os alunos.</td></tr>`;

    // Clear operational data
    const opFaturamento = document.getElementById('op-val-faturamento');
    const opDescontos = document.getElementById('op-val-descontos');
    const opTicket = document.getElementById('op-val-ticket-medio');
    const opClientes = document.getElementById('op-val-clientes-ativos');
    const opHoras = document.getElementById('op-val-horas-ocupadas');
    const opEffRows = document.getElementById('op-table-efficiency-rows');
    const opSubRows = document.getElementById('op-table-subcategory-rows');

    if (opFaturamento) opFaturamento.innerText = 'R$ 0,00';
    if (opDescontos) {
      opDescontos.innerText = '0,00%';
      const subtitle = opDescontos.parentElement.querySelector('.metric-subtitle');
      if (subtitle) subtitle.innerText = 'R$ 0,00 em descontos';
    }
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
    const nextMonthStart = (() => {
      const d = new Date(monthStart + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0].substring(0, 8) + '01';
    })();

    // 1. Fetch data from Supabase views concurrently using Promise.allSettled
    const payParams = `select=*&mes=eq.${monthStart}`;
    const subParams = `select=*&mes=eq.${monthStart}`;
    const itemsParams = `select=categoria,subcategoria,customer_code,valor_liquido,valor_faturamento,valor_bruto,valor_desconto,item_description,pay_date&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}`;

    const [
      payDataResult,
      subDataResult,
      courtDataResult,
      effDataResult,
      freqDataResult,
      paidVendasResult,
      itemsDataResult
    ] = await Promise.allSettled([
      supabaseSelect('vw_mt_resumo_por_forma_pagamento_pago_mes', payParams),
      supabaseSelect('vw_mt_ticket_medio_subcategoria_pago_mes', subParams),
      supabaseSelect('vw_mt_ocupacao_quadras_mes', `select=*&mes=eq.${monthStart}`),
      supabaseSelect('vw_mt_faturamento_por_hora_ocupada', `select=*&mes=eq.${monthStart}`),
      supabaseSelect('vw_mt_frequencia_clientes_mes', `select=*&mes=eq.${monthStart}`),
      supabaseSelect('mt_faturamento_vendas', `select=customer_code&paid=eq.true&pay_date=gte.${monthStart}&pay_date=lt.${nextMonthStart}&is_canceled=eq.false&tipo=neq.refund`),
      supabaseSelect('vw_mt_faturamento_itens_pago', itemsParams)
    ]);

    const payData = payDataResult.status === 'fulfilled' ? payDataResult.value : [];
    const subData = subDataResult.status === 'fulfilled' ? subDataResult.value : [];
    const courtData = courtDataResult.status === 'fulfilled' ? courtDataResult.value : [];
    const effData = effDataResult.status === 'fulfilled' ? effDataResult.value : [];
    const freqData = freqDataResult.status === 'fulfilled' ? freqDataResult.value : [];
    const paidVendasData = paidVendasResult.status === 'fulfilled' ? paidVendasResult.value : [];
    const itemsData = itemsDataResult.status === 'fulfilled' ? itemsDataResult.value : [];

    if (payDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_resumo_por_forma_pagamento_pago_mes', payDataResult.reason);
    if (subDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_ticket_medio_subcategoria_pago_mes', subDataResult.reason);
    if (courtDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_ocupacao_quadras_mes', courtDataResult.reason);
    if (effDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_faturamento_por_hora_ocupada', effDataResult.reason);
    if (freqDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_frequencia_clientes_mes', freqDataResult.reason);
    if (paidVendasResult.status === 'rejected') debugError('Erro ao carregar mt_faturamento_vendas', paidVendasResult.reason);
    if (itemsDataResult.status === 'rejected') debugError('Erro ao carregar vw_mt_faturamento_itens_pago', itemsDataResult.reason);

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

    // Calculate discounts from itemsData
    let totalDesconto = 0;
    let totalBruto = 0;
    itemsData.forEach(item => {
      totalDesconto += parseFloat(item.valor_desconto) || 0;
      totalBruto += parseFloat(item.valor_bruto) || 0;
    });
    if (totalBruto <= 0) {
      totalBruto = totalFaturamentoLiquido + totalDesconto;
    }
    const pctDesconto = totalBruto > 0 ? (totalDesconto / totalBruto) * 100 : 0;

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
    const opDescontos = document.getElementById('op-val-descontos');
    const opTicket = document.getElementById('op-val-ticket-medio');
    const opClientes = document.getElementById('op-val-clientes-ativos');
    const opHoras = document.getElementById('op-val-horas-ocupadas');

    if (opFaturamento) opFaturamento.innerText = formatCurrency(totalFaturamentoLiquido);
    
    if (opDescontos) {
      opDescontos.innerText = `${pctDesconto.toFixed(2).replace('.', ',')}%`;
      const subtitle = opDescontos.parentElement.querySelector('.metric-subtitle');
      if (subtitle) {
        subtitle.innerText = `${formatCurrency(totalDesconto)} em descontos`;
      } else {
        const sub = document.createElement('small');
        sub.className = 'metric-subtitle';
        sub.style.cssText = 'display:block;color:rgba(241,244,224,0.45);font-size:0.72rem;margin-top:2px;';
        sub.innerText = `${formatCurrency(totalDesconto)} em descontos`;
        opDescontos.parentElement.appendChild(sub);
      }
    }

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

    // Fetch unique active students: all students with class bookings from the selected month onwards
    // Uses vw_mt_alunos_ativos_por_mes (based directly on mt_bookings + mt_booking_participantes),
    // which is NOT coupled to payments — so it correctly counts students even if payment hasn't been
    // matched yet. This gives the true active student base (current + future confirmed starts).
    const activeStudentsParams = `select=customer_code&entry_date=lte.${monthEnd}`;
    const activeStudentsData = await supabaseSelect('vw_mt_alunos_ativos_por_mes', activeStudentsParams);

    const activeStudentsSet = new Set();
    activeStudentsData.forEach(row => {
      if (row.customer_code) activeStudentsSet.add(row.customer_code);
    });
    const totalActiveStudents = activeStudentsSet.size;

    // Render Acompanhamento de Metas Widget
    renderGoalsDashboard(itemsData, courtData, totalHoursOcupadas, year, month, totalActiveStudents);
    // Deduct teacher commission for class categories directly from the database pre-calculated values
    effData.forEach(item => {
      let hourly = parseFloat(item.faturamento_por_hora_ocupada) || 0;
      if (item.tipo_operacional.startsWith('Aulas -')) {
        hourly = hourly * (1 - currentCommissionRate / 100);
      }
      item.faturamento_por_hora_ocupada = hourly;
    });

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

    // Rebuild subcategory dataset on the client side using the smart classification from itemsData
    const groupedSubcategories = {
      'Aulas - Regular': { name: 'Aulas - Regular', clients: new Set(), total: 0 },
      'Aulas - Avulsas': { name: 'Aulas - Avulsas', clients: new Set(), total: 0 },
      'Locação - Quadra Avulsa': { name: 'Locação - Quadra Avulsa', clients: new Set(), total: 0 },
      'Locação - Reserva Mensal': { name: 'Locação - Reserva Mensal', clients: new Set(), total: 0 },
      'Lanchonete': { name: 'Lanchonete', clients: new Set(), total: 0 }
    };

    itemsData.forEach(item => {
      const desc = (item.item_description || '').toLowerCase();
      const cat = (item.categoria || '').toLowerCase();
      const prod = (item.produto_padronizado || '').toLowerCase();
      const val = parseFloat(item.valor_faturamento) || 0;
      const client = item.customer_code;

      const isLesson = cat === 'aulas' || desc.includes('tênis') || desc.includes('aula') || desc.includes('kids') || desc.includes('baby') || prod.includes('tênis') || prod.includes('aula');
      const isRental = cat === 'locação' || desc.includes('locação') || desc.includes('reserva') || prod.includes('locação') || prod.includes('reserva');

      if (isLesson) {
        const isAvulsa = desc.includes('avulsa');
        const subKey = isAvulsa ? 'Aulas - Avulsas' : 'Aulas - Regular';
        groupedSubcategories[subKey].total += val;
        if (client) groupedSubcategories[subKey].clients.add(client);
      } else if (isRental) {
        const isReserva = desc.includes('reserva') || prod.includes('reserva') || cat.includes('reserva') || (item.subcategoria || '').toLowerCase().includes('reserva');
        const subKey = isReserva ? 'Locação - Reserva Mensal' : 'Locação - Quadra Avulsa';
        groupedSubcategories[subKey].total += val;
        if (client) groupedSubcategories[subKey].clients.add(client);
      } else {
        groupedSubcategories['Lanchonete'].total += val;
        if (client) groupedSubcategories['Lanchonete'].clients.add(client);
      }
    });

    const processedSubData = Object.values(groupedSubcategories)
      .filter(sub => sub.total > 0.01)
      .map(sub => ({
        subcategoria: sub.name,
        qtd_clientes: sub.clients.size,
        valor_liquido_total: sub.total,
        ticket_medio_por_cliente: sub.clients.size > 0 ? (sub.total / sub.clients.size) : 0
      }));

    // Sort by total faturamento desc
    processedSubData.sort((a, b) => b.valor_liquido_total - a.valor_liquido_total);

    // Table 2: Subcategoria
    const subcategoryRows = document.getElementById('op-table-subcategory-rows');
    if (subcategoryRows) {
      if (processedSubData.length === 0) {
        subcategoryRows.innerHTML = `<tr><td colspan="4" class="empty-state">Sem dados de subcategoria para este mês.</td></tr>`;
      } else {
        subcategoryRows.innerHTML = processedSubData.map(item => `
          <tr>
            <td>${item.subcategoria}</td>
            <td class="text-center">${item.qtd_clientes}</td>
            <td class="text-right">${formatCurrency(item.valor_liquido_total)}</td>
            <td class="text-right font-semibold">${formatCurrency(item.ticket_medio_por_cliente)}</td>
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

    // Fetch revenue subcategory + paying clients for the 6-month window in one pass
    const firstMonth = historicMonths[0].monthStart;
    const lastMonth = historicMonths[historicMonths.length - 1].monthStart;

    const [histSubData, histPaidVendasData] = await Promise.all([
      supabaseSelect('vw_mt_ticket_medio_subcategoria_pago_mes', `select=mes,valor_liquido_total&mes=gte.${firstMonth}&mes=lte.${lastMonth}`),
      supabaseSelect('mt_faturamento_vendas', `select=customer_code,pay_date&paid=eq.true&is_canceled=eq.false&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}&tipo=neq.refund`)
    ]);

    // Aggregate revenue by month
    const revenueByMonth = {};
    histSubData.forEach(row => {
      const k = row.mes ? row.mes.split('T')[0].substring(0, 7) : null;
      if (k) revenueByMonth[k] = (revenueByMonth[k] || 0) + (parseFloat(row.valor_liquido_total) || 0);
    });

    // Aggregate distinct paying clients by month (anyone who generated revenue, not just students)
    const payingClientsByMonth = {};
    histPaidVendasData.forEach(row => {
      if (!row.pay_date) return;
      const k = row.pay_date.substring(0, 7);
      if (!payingClientsByMonth[k]) payingClientsByMonth[k] = new Set();
      if (row.customer_code) payingClientsByMonth[k].add(row.customer_code);
    });

    historicMonths.forEach(({ label, monthStart: ms }) => {
      const key = ms.substring(0, 7); // e.g. "2026-06"
      monthsLabels.push(label);
      historicalRevenue.push(revenueByMonth[key] || 0);
      // Use paying clients (distinct customers who generated any revenue that month)
      historicalStudents.push(payingClientsByMonth[key] ? payingClientsByMonth[key].size : 0);
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

    // Ticket médio per month = revenue / paying clients (reuse payingClientsByMonth built above)
    const ticketMedioHistory = historicMonths.map(({ monthStart: ms }) => {
      const key = ms.substring(0, 7);
      const rev = revenueByMonth[key] || 0;
      const clients = payingClientsByMonth[key] ? payingClientsByMonth[key].size : 0;
      return clients > 0 ? parseFloat((rev / clients).toFixed(2)) : 0;
    });

    // Cache operational metrics for the monthly report
    cachedMonthsLabels = monthsLabels;
    cachedHistoricalRevenue = historicalRevenue;
    cachedHistoricalStudents = historicalStudents;
    cachedOccupancyHistoryPct = occupancyHistoryPct;
    cachedTicketMedioHistory = ticketMedioHistory;
    cachedProcessedSubData = processedSubData;
    cachedCourtData = courtData;
    cachedPayData = payData;

    renderChartRevenueHistory(monthsLabels, historicalRevenue, historicalStudents);
    renderChartPaymethods(payData);
    renderChartSubcategories(processedSubData);
    renderChartCourtOccupancy(courtData, parseInt(year, 10), parseInt(month, 10));
    renderChartOccupancyHistory(monthsLabels, occupancyHistoryPct);
    renderChartTicketHistory(monthsLabels, ticketMedioHistory);

  } catch (err) {
    debugError('Erro ao carregar relatórios operacionais', err);
  }
}

// ---- Chart Rendering Handlers ----

function renderChartOccupancyHistory(labels, pctValues, canvasId = 'chart-occupancy-history', instanceKey = 'occupancyHistory') {
  destroyChart(instanceKey);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isReport = canvasId.includes('report');
  const textColor = isReport ? '#191919' : 'rgba(241, 244, 224, 0.7)';
  const gridColor = isReport ? 'rgba(0, 0, 0, 0.06)' : 'rgba(241, 244, 224, 0.05)';

  const plugins = [];
  plugins.push({
    id: 'occupancyLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const dataValue = dataset.data[index];
          if (dataValue === 0 || dataValue === null || dataValue === undefined) return;
          const formattedValue = dataValue.toFixed(1).replace('.', ',') + '%';
          ctx.save();
          ctx.fillStyle = isReport ? '#1e7268' : '#2a9d8f';
          ctx.font = 'bold 10px Hanken Grotesk, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(formattedValue, element.x, element.y - 8);
          ctx.restore();
        });
      });
    }
  });

  chartInstances[instanceKey] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ocupação Produtiva (%)',
        data: pctValues,
        borderColor: '#2a9d8f',
        backgroundColor: isReport ? 'rgba(42, 157, 143, 0.06)' : 'rgba(42, 157, 143, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#2a9d8f',
        pointBorderColor: isReport ? '#fff' : '#1c1c1c',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      animation: canvasId.includes('report') ? false : {},
      animations: canvasId.includes('report') ? false : {},
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
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Hanken Grotesk' },
            callback: v => v + '%'
          }
        }
      }
    },
    plugins: plugins
  });
}

function renderChartTicketHistory(labels, values, canvasId = 'chart-ticket-history', instanceKey = 'ticketHistory') {
  destroyChart(instanceKey);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isReport = canvasId.includes('report');
  const textColor = isReport ? '#191919' : 'rgba(241, 244, 224, 0.7)';
  const gridColor = isReport ? 'rgba(0, 0, 0, 0.06)' : 'rgba(241, 244, 224, 0.05)';

  const plugins = [];
  plugins.push({
    id: 'ticketLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const dataValue = dataset.data[index];
          if (dataValue === 0 || dataValue === null || dataValue === undefined) return;
          const formattedValue = 'R$ ' + Math.round(dataValue).toLocaleString('pt-BR');
          ctx.save();
          ctx.fillStyle = isReport ? '#b18e38' : '#e9c46a';
          ctx.font = 'bold 10px Hanken Grotesk, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(formattedValue, element.x, element.y - 8);
          ctx.restore();
        });
      });
    }
  });

  chartInstances[instanceKey] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ticket Médio (R$)',
        data: values,
        borderColor: '#e9c46a',
        backgroundColor: isReport ? 'rgba(233, 196, 106, 0.06)' : 'rgba(233, 196, 106, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#e9c46a',
        pointBorderColor: isReport ? '#fff' : '#1c1c1c',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      animation: canvasId.includes('report') ? false : {},
      animations: canvasId.includes('report') ? false : {},
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
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' } }
        },
        y: {
          min: 0,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Hanken Grotesk' },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR')
          }
        }
      }
    },
    plugins: plugins
  });
}


function renderChartRevenueHistory(labels, revenues, students, canvasId = 'chart-revenue-history', instanceKey = 'revenueHistory') {

  destroyChart(instanceKey);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isReport = canvasId.includes('report');
  const textColor = isReport ? '#191919' : 'rgba(241, 244, 224, 0.7)';
  const gridColor = isReport ? 'rgba(0, 0, 0, 0.06)' : 'rgba(241, 244, 224, 0.05)';
  const legendColor = isReport ? '#191919' : '#f1f4e0';

  const plugins = [];
  plugins.push({
    id: 'revenueLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const dataValue = dataset.data[index];
          if (dataValue === 0 || dataValue === null || dataValue === undefined) return;
          
          ctx.save();
          ctx.font = 'bold 10px Hanken Grotesk, sans-serif';
          ctx.textAlign = 'center';
          
          if (datasetIndex === 0) {
            // Faturamento (Bar) - Draw inside the orange bar
            const formattedValue = 'R$ ' + Math.round(dataValue).toLocaleString('pt-BR');
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'top';
            ctx.fillText(formattedValue, element.x, element.y + 8);
          } else {
            // Clientes Ativos (Line) - Draw above the line point
            const formattedValue = Math.round(dataValue) + ' cli';
            ctx.fillStyle = isReport ? '#1e7268' : '#f1f4e0';
            ctx.textBaseline = 'bottom';
            ctx.fillText(formattedValue, element.x, element.y - 8);
          }
          ctx.restore();
        });
      });
    }
  });

  chartInstances[instanceKey] = new Chart(ctx, {
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
          label: 'Clientes Ativos',
          data: students,
          type: 'line',
          borderColor: isReport ? '#2a9d8f' : '#f1f4e0',
          backgroundColor: isReport ? '#2a9d8f' : '#f1f4e0',
          borderWidth: 3,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      animation: canvasId.includes('report') ? false : {},
      animations: canvasId.includes('report') ? false : {},
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: legendColor, font: { family: 'Hanken Grotesk' } } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Hanken Grotesk' } } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' }, callback: value => 'R$ ' + value.toLocaleString('pt-BR') }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' }, stepSize: 5 }
        }
      }
    },
    plugins: plugins
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
              const dataset = context.dataset.data;
              const total = dataset.reduce((sum, v) => sum + v, 0);
              const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              const formattedPercentage = String(percentage).replace('.', ',');
              return ` ${context.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${formattedPercentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderChartSubcategories(data, canvasId = 'chart-subcategory', instanceKey = 'subcategories') {
  destroyChart(instanceKey);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isReport = canvasId.includes('report');
  const textColor = isReport ? '#191919' : 'rgba(241, 244, 224, 0.7)';
  const gridColor = isReport ? 'rgba(0, 0, 0, 0.06)' : 'rgba(241, 244, 224, 0.05)';

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
        c.fillStyle = isReport ? 'rgba(25, 25, 25, 0.75)' : 'rgba(241, 244, 224, 0.65)';
        c.font = '600 11px Hanken Grotesk, sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`${pct}%`, xEnd, yCenter);
        c.restore();
      });
    }
  };

  chartInstances[instanceKey] = new Chart(ctx, {
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
      animation: canvasId.includes('report') ? false : {},
      animations: canvasId.includes('report') ? false : {},
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
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' }, callback: value => 'R$ ' + value.toLocaleString('pt-BR') }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Hanken Grotesk' } }
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
    if (dow === 0 || dow === 6) total += 11;
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

    const procfyParams = `or=(and(due_date.gte.${firstMonth},due_date.lte.${projectionEnd}),and(paid.eq.false,due_date.lt.${firstMonth}))`;
    const interParams = `data_movimento=gte.${firstMonth}&data_movimento=lte.${monthEnd}`;
    const salesParams = `select=valor_faturamento,pay_date,reference,item_description,quantity,customer_code&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}`;
    const commParams = `select=booking_id,booking_value,booking_commission_base,is_socio_benefit,booking_date,is_paid,participant_name,start_time,booking_type,description,professor,customer_code,pay_date,resource_name&or=(and(booking_date.gte.${firstMonth},booking_date.lte.${monthEnd}),and(pay_date.gte.${firstMonth},pay_date.lt.${nextMonthStart}))`;
    const payParams = `payment_date=gte.${firstMonth}&payment_date=lt.${nextMonthStart}`;
    const mpParams = `date_approved=gte.${firstMonth}&date_approved=lt.${nextMonthStart}&status=eq.approved`;
    const voucherParams = `description=ilike.*INTENSIV*&paid=eq.true&is_canceled=eq.false&pay_date=gte.${firstMonth}&pay_date=lt.${nextMonthStart}`;
    const receivablesParams = `data_liberacao=gte.${firstMonth}&data_liberacao=lte.${projectionEnd}`;

    const occupancyParams = `select=*&ano=eq.${year}&mes=eq.${month}`;
    const efficiencyParams = `select=*&ano=eq.${year}&mes=eq.${month}`;

    let prevYear = parseInt(year, 10);
    let prevMonth = parseInt(month, 10) - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = String(prevMonth).padStart(2, '0');
    const prevOccupancyParams = `select=*&ano=eq.${prevYear}&mes=eq.${prevMonthStr}`;
    const prevEfficiencyParams = `select=*&ano=eq.${prevYear}&mes=eq.${prevMonthStr}`;

    const results = await Promise.allSettled([
      supabaseSelect('procfy_lancamentos', procfyParams),
      supabaseSelect('inter_movimentos_processados', interParams),
      supabaseSelect('vw_mt_faturamento_itens_pago', salesParams),
      supabaseSelect('vw_mt_comissoes_detalhadas', commParams),
      supabaseSelect('mt_faturamento_pagamentos', payParams),
      supabaseSelect('mp_pagamentos', mpParams),
      supabaseSelect('mt_pagamentos_professores', `reference_period=eq.${monthStart}`),
      supabaseSelect('mt_custo_produtos'),
      supabaseSelect('vw_mt_ocupacao_quadras_mes', `select=*&mes=eq.${monthStart}`),
      supabaseSelect('vw_mt_faturamento_por_hora_ocupada', `select=*&mes=eq.${monthStart}`),
      supabaseSelect('vw_mt_ocupacao_quadras_mes', `select=*&mes=eq.${prevYear}-${prevMonthStr}-01`),
      supabaseSelect('vw_mt_faturamento_por_hora_ocupada', `select=*&mes=eq.${prevYear}-${prevMonthStr}-01`),
      supabaseSelect('mt_faturamento_vendas', voucherParams),
      supabaseSelect('mt_agenda_recebiveis_importada', receivablesParams)
    ]);

    const allProcfyData = results[0].status === 'fulfilled' ? results[0].value : [];
    const allInterData = results[1].status === 'fulfilled' ? results[1].value : [];
    const allSalesData = results[2].status === 'fulfilled' ? results[2].value : [];
    const allCommData = results[3].status === 'fulfilled' ? results[3].value : [];
    const allPaymentMethodsData = results[4].status === 'fulfilled' ? results[4].value : [];
    const allMpPaymentsData = results[5].status === 'fulfilled' ? results[5].value : [];
    const allGlobalPayoutsData = results[6].status === 'fulfilled' ? results[6].value : [];
    const allProductCostsData = results[7].status === 'fulfilled' ? results[7].value : [];
    const baseCourtOccupancy = results[8].status === 'fulfilled' ? results[8].value : [];
    const baseHourlyEfficiency = results[9].status === 'fulfilled' ? results[9].value : [];
    const prevCourtOccupancy = results[10].status === 'fulfilled' ? results[10].value : [];
    const prevHourlyEfficiency = results[11].status === 'fulfilled' ? results[11].value : [];
    const allVouchersData = results[12].status === 'fulfilled' ? results[12].value : [];
    const allImportedReceivablesData = results[13].status === 'fulfilled' ? results[13].value : [];

    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        const endpoints = [
          'procfy_lancamentos', 'inter_movimentos_processados', 'vw_mt_faturamento_itens_pago',
          'vw_mt_comissoes_detalhadas', 'mt_faturamento_pagamentos', 'mp_pagamentos',
          'mt_pagamentos_professores', 'mt_custo_produtos', 'vw_mt_ocupacao_quadras_mes (atual)',
          'vw_mt_faturamento_por_hora_ocupada (atual)', 'vw_mt_ocupacao_quadras_mes (anterior)',
          'vw_mt_faturamento_por_hora_ocupada (anterior)', 'mt_faturamento_vendas', 'mt_agenda_recebiveis_importada'
        ];
        debugError(`Erro ao carregar ${endpoints[i]}`, res.reason);
      }
    });

    debugLog(`Lançamentos Procfy: ${allProcfyData.length} linhas.`);
    debugLog(`Movimentos Inter: ${allInterData.length} linhas.`);
    debugLog(`Lançamentos Vendas: ${allSalesData.length} linhas.`);
    debugLog(`Agendamentos Comissões: ${allCommData.length} linhas.`);
    debugLog(`Lançamentos Pagamentos (MatchPoint): ${allPaymentMethodsData.length} linhas.`);
    debugLog(`Lançamentos Mercado Pago: ${allMpPaymentsData.length} linhas.`);
    debugLog(`Agenda Recebíveis Importada: ${allImportedReceivablesData.length} linhas.`);

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

      // Skip internal transfers for July 2026 onwards to avoid double counting
      if (tx.transaction_type === 'transfer' && monthKey >= '2026-07') return;

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

    // Constant cutoff and initial investment balance
    const INVESTMENT_CUTOFF_MONTH = '2026-07';
    const INITIAL_INVESTMENT_BALANCE = 111.79;

    // Process Banco Inter CDB / investment transactions for DFC
    allInterData.forEach(tx => {
      const desc = (tx.descricao || '').toLowerCase();
      const title = (tx.titulo || '').toLowerCase();
      
      const isInvTx = tx.tipo_transacao_inter === 'INVESTIMENTO' ||
                      desc.includes('resgate') || desc.includes('cdb') || desc.includes('firf') || desc.includes('aplicação') || desc.includes('aplicacao') ||
                      title.includes('resgate') || title.includes('cdb') || title.includes('firf') || title.includes('aplicação') || title.includes('aplicacao');

      if (isInvTx) {
        const monthKey = tx.data_movimento ? tx.data_movimento.substring(0, 7) : '';
        if (!monthlyData[monthKey] || monthKey < '2026-06') return;

        const valComSinal = parseFloat(tx.valor_com_sinal) || 0;
        
        if (monthKey < INVESTMENT_CUTOFF_MONTH) {
          // Keep old behavior for June 2026: only process resgates (credits) as positive inflow
          const isResgate = desc.includes('resgate') || desc.includes('cdb') || title.includes('resgate');
          if (isResgate && valComSinal > 0) {
            const amount = Math.abs(valComSinal);
            const category = 'Resgate de Aplicação Financeira (CDB)';
            allCategories.fci.add(category);
            monthlyData[monthKey].fci.categories[category] = (monthlyData[monthKey].fci.categories[category] || 0.0) + amount;
            monthlyData[monthKey].fci.net += amount;
            monthlyData[monthKey].net += amount;
          }
        } else {
          // New behavior for July 2026 onwards:
          // Internal transfers (applications and redemptions) are completely excluded from the DFC table 
          // because they are moves between cash accounts and have net zero effect on consolidated cash.
          // This ensures that FCO + FCI + FCS matches the change in Saldo Final.
        }
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
      } else if (mKey === INVESTMENT_CUTOFF_MONTH) {
        // July starts with June's final balance + initial investment balance
        const prevKey = monthKeys[i - 1];
        monthlyData[mKey].initial = monthlyData[prevKey].final + INITIAL_INVESTMENT_BALANCE;
        monthlyData[mKey].final = monthlyData[mKey].initial + monthlyData[mKey].net;
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
      if (currentMonthKey >= '2026-07') {
        const [curYear, curMonth] = currentMonthKey.split('-');
        const lastDay = new Date(parseInt(curYear, 10), parseInt(curMonth, 10), 0).getDate();
        const monthEndStr = `${currentMonthKey}-${String(lastDay).padStart(2, '0')}`;
        const finalInv = calculateInvestmentBalance(allInterData, monthEndStr);
        const finalCc = curFinal - finalInv;
        elInicialSubtitle.innerText = `Saldo Inicial: ${formatCurrency(curInitial)} | CC: ${formatCurrency(finalCc)} | Inv: ${formatCurrency(finalInv)}`;
      } else {
        elInicialSubtitle.innerText = 'Saldo Inicial: ' + formatCurrency(curInitial);
      }
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
        cogs: 0.0,
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

    // Populate DRE Gross Revenue & Calculate CMV for Lanchonete items
    allSalesData.forEach(sale => {
      const monthKey = sale.pay_date ? sale.pay_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;
      
      const valFat = parseFloat(sale.valor_faturamento) || 0.0;
      dreData[monthKey].receitaBruta += valFat;

      // Find matching cost from Supabase table
      const saleDate = (sale.pay_date && sale.pay_date.substring(0, 10)) || '';
      
      // Match by SKU or Description within validity dates
      const matchedCostRow = (allProductCostsData || []).find(costRow => {
        // Validate date range
        const start = costRow.data_inicio || '2026-01-01';
        const end = costRow.data_fim || '9999-12-31';
        if (saleDate < start || saleDate > end) return false;

        // Match SKU (ref)
        if (sale.reference && costRow.sku) {
          const skuClean = costRow.sku.trim().replace(/^0+/, '');
          const refClean = sale.reference.trim().replace(/^0+/, '');
          if (skuClean && refClean && skuClean === refClean) return true;
        }

        // Match Description
        if (sale.item_description && costRow.description) {
          const descClean = costRow.description.toLowerCase().trim().replace(/\s+/g, ' ');
          const itemDescClean = sale.item_description.toLowerCase().trim().replace(/\s+/g, ' ');
          if (descClean === itemDescClean) return true;
        }

        return false;
      });

      if (matchedCostRow) {
        const unitCost = parseFloat(matchedCostRow.custo_unitario) || 0.0;
        const qty = parseFloat(sale.quantity) || 1.0;
        const totalCost = unitCost * qty;

        dreData[monthKey].cogs = (dreData[monthKey].cogs || 0.0) + totalCost;
      }
    });

    // Populate DRE Commissions
    allCommData.forEach(row => {
      if (!row.is_paid) return;
      // Agrupa comissões no mês do pagamento (pay_date), usando a data da aula como fallback caso pay_date falhe
      const monthKey = (row.pay_date && row.pay_date.substring(0, 7)) || (row.booking_date ? row.booking_date.substring(0, 7) : '');
      if (!dreData[monthKey]) return;
      
      const rawBase = parseFloat(row.booking_commission_base) || (row.is_socio_benefit ? (parseFloat(row.booking_value) * 2) : (parseFloat(row.booking_value) || 0.0));
      const commBase = getAdjustedCommissionBase(row, rawBase);
      const rate = getRateForTeacher(row.professor);
      dreData[monthKey].comissao += commBase * (rate / 100);
    });

    // Populate DRE Vouchers Commissions
    const filteredVouchers = (allVouchersData || []).filter(v => {
      const prof = parseVoucherProfessor(v.description || '');
      return prof && parseFloat(v.total) > 0 && !/anula/i.test(v.description || '');
    });

    filteredVouchers.forEach(v => {
      const prof = parseVoucherProfessor(v.description || '');
      const val = parseFloat(v.total) || 0.0;
      const monthKey = v.pay_date ? v.pay_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;

      const rate = getRateForTeacher(prof);
      dreData[monthKey].comissao += val * (rate / 100);
    });

    // Populate DRE Expenses (Operation cost center)
    allProcfyData.forEach(tx => {
      if (tx.cost_center_descricao !== 'Operação') return;
      if (tx.transaction_type === 'revenue') return;

      const monthKey = tx.due_date ? tx.due_date.substring(0, 7) : '';
      if (!dreData[monthKey]) return;

      const amount = parseFloat(tx.amount) || 0.0;
      const category = tx.category_name || 'Outras Despesas';

      // Exclude teacher commissions from operational expenses to prevent duplication,
      // as commissions are already calculated from allCommData below Net Revenue
      if (category.toLowerCase().includes('comissão') || category.toLowerCase().includes('comissao')) {
        return;
      }

      if (category === 'Energia Elétrica') {
        dreData[monthKey].energia += amount;
      } else {
        // Skip 'Estoque Bar/Lanchonete' from Procfy in DRE because we calculate it via COGS/CMV from sales
        // Skip 'Simples - Imposto' because we already calculate it pro-forma under Gross Revenue
        if (category === 'Estoque Bar/Lanchonete' || category === 'Simples - Imposto') {
          return;
        }
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
      d.cogs = round2(d.cogs || 0.0);
      d.comissao = round2(d.comissao);
      d.energia = round2(d.energia);
      d.taxasProcessamento = round2(d.taxasProcessamento);
      d.despesasOperacionais = round2(d.despesasOperacionais);

      // If no activity (revenue is 0), keep everything zeroed
      if (d.receitaBruta === 0.0) {
        d.impostos = 0.0;
        d.receitaLiquida = 0.0;
        d.cogs = 0.0;
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
      d.lucroBruto = round2(d.receitaLiquida - d.cogs - d.comissao - d.energia - d.taxasProcessamento);
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
    dreBodyHtml += renderDreRowHtml('Custo dos Produtos Vendidos (Lanchonete)', [], (d) => -d.cogs, true);
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
      allGlobalPayoutsData,
      allProductCostsData,
      allVouchersData,
      allImportedReceivablesData,
      baseCourtOccupancy,
      baseHourlyEfficiency,
      prevCourtOccupancy,
      prevHourlyEfficiency,
      monthStart,
      monthEnd,
      year,
      month,
      historicMonths,
      monthlyData,
      dreData,
      baseCourtOccupancy,
      baseHourlyEfficiency
    };

    // Calculate daily projection first — it stores the June 30 balance in cachedMonthEndProjectionBalance
    // Then the 3-month projection reads that value as the July opening balance
    calculateAndRenderCurrentMonthProjection();
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

const mainTabReport = document.getElementById('main-tab-report');
const sectionReport = document.getElementById('section-report');

if (mainTabCommissions && mainTabOperational && mainTabFinancial) {
  mainTabCommissions.addEventListener('click', () => {
    currentMainTab = 'commissions';
    mainTabCommissions.classList.add('active');
    mainTabOperational.classList.remove('active');
    mainTabFinancial.classList.remove('active');
    if (mainTabReport) mainTabReport.classList.remove('active');
    
    document.body.className = 'active-tab-commissions';

    if (sectionCommissions) sectionCommissions.style.display = 'block';
    if (sectionOperational) sectionOperational.style.display = 'none';
    if (sectionFinancial) sectionFinancial.style.display = 'none';
    if (sectionReport) sectionReport.style.display = 'none';

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
    if (mainTabReport) mainTabReport.classList.remove('active');

    document.body.className = 'active-tab-operational';

    if (sectionCommissions) sectionCommissions.style.display = 'none';
    if (sectionOperational) sectionOperational.style.display = 'block';
    if (sectionFinancial) sectionFinancial.style.display = 'none';
    if (sectionReport) sectionReport.style.display = 'none';

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
    if (mainTabReport) mainTabReport.classList.remove('active');

    document.body.className = 'active-tab-financial';

    if (sectionCommissions) sectionCommissions.style.display = 'none';
    if (sectionOperational) sectionOperational.style.display = 'none';
    if (sectionFinancial) sectionFinancial.style.display = 'block';
    if (sectionReport) sectionReport.style.display = 'none';

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

  if (mainTabReport && sectionReport) {
    mainTabReport.addEventListener('click', () => {
      currentMainTab = 'report';
      mainTabReport.classList.add('active');
      mainTabCommissions.classList.remove('active');
      mainTabOperational.classList.remove('active');
      mainTabFinancial.classList.remove('active');

      document.body.className = 'active-tab-report';

      if (sectionCommissions) sectionCommissions.style.display = 'none';
      if (sectionOperational) sectionOperational.style.display = 'none';
      if (sectionFinancial) sectionFinancial.style.display = 'none';
      if (sectionReport) sectionReport.style.display = 'block';

      // Update page title and subtitle for report context
      const pageTitle = document.querySelector('.page-title');
      if (pageTitle) pageTitle.innerText = 'Relatório Mensal';
      const pageSubtitle = document.getElementById('dashboard-subtitle');
      if (pageSubtitle) {
        const year = selectYear.value;
        const month = selectMonth.value;
        const monthStart = `${year}-${month}-01`;
        pageSubtitle.innerText = `Gerador de Relatório Consolidado — ${getMonthNameBR(monthStart)}`;
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

      loadMonthlyReport();
    });
  }
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
const btnShowProjectionCurrent = document.getElementById('btn-show-projection-current');
const cardDfc = document.getElementById('fin-dfc-card');
const cardDre = document.getElementById('fin-dre-card');
const cardRoi = document.getElementById('fin-roi-card');
const cardProjection = document.getElementById('fin-projection-card');
const cardProjectionCurrent = document.getElementById('fin-projection-current-card');
const receivablesUploadCard = document.getElementById('receivables-upload-card');

if (btnShowDfc && btnShowDre && btnShowRoi && btnShowProjection && btnShowProjectionCurrent && 
    cardDfc && cardDre && cardRoi && cardProjection && cardProjectionCurrent) {
  btnShowDfc.addEventListener('click', () => {
    btnShowDfc.classList.add('active');
    btnShowDre.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjection.classList.remove('active');
    btnShowProjectionCurrent.classList.remove('active');
    cardDfc.style.display = 'block';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'none';
    cardProjectionCurrent.style.display = 'none';
    if (receivablesUploadCard) receivablesUploadCard.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection');
      sectionFinancial.classList.remove('show-projection-current');
    }
  });

  btnShowDre.addEventListener('click', () => {
    btnShowDre.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjection.classList.remove('active');
    btnShowProjectionCurrent.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'block';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'none';
    cardProjectionCurrent.style.display = 'none';
    if (receivablesUploadCard) receivablesUploadCard.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-dre');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection');
      sectionFinancial.classList.remove('show-projection-current');
    }
  });

  btnShowRoi.addEventListener('click', () => {
    btnShowRoi.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowDre.classList.remove('active');
    btnShowProjection.classList.remove('active');
    btnShowProjectionCurrent.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'block';
    cardProjection.style.display = 'none';
    cardProjectionCurrent.style.display = 'none';
    if (receivablesUploadCard) receivablesUploadCard.style.display = 'none';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-roi');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-projection');
      sectionFinancial.classList.remove('show-projection-current');
    }
    
    // Recalculate and render ROI data
    calculateAndRenderRoi();
  });

  btnShowProjection.addEventListener('click', () => {
    btnShowProjection.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowDre.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjectionCurrent.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'block';
    cardProjectionCurrent.style.display = 'none';
    if (receivablesUploadCard) receivablesUploadCard.style.display = 'block';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-projection');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection-current');
    }
    
    // Recalculate and render Projection data
    calculateAndRenderProjection();
  });

  btnShowProjectionCurrent.addEventListener('click', () => {
    btnShowProjectionCurrent.classList.add('active');
    btnShowDfc.classList.remove('active');
    btnShowDre.classList.remove('active');
    btnShowRoi.classList.remove('active');
    btnShowProjection.classList.remove('active');
    cardDfc.style.display = 'none';
    cardDre.style.display = 'none';
    cardRoi.style.display = 'none';
    cardProjection.style.display = 'none';
    cardProjectionCurrent.style.display = 'block';
    if (receivablesUploadCard) receivablesUploadCard.style.display = 'block';

    if (sectionFinancial) {
      sectionFinancial.classList.add('show-projection-current');
      sectionFinancial.classList.remove('show-dfc');
      sectionFinancial.classList.remove('show-dre');
      sectionFinancial.classList.remove('show-roi');
      sectionFinancial.classList.remove('show-projection');
    }
    
    // Recalculate and render Current Month Projection data
    calculateAndRenderCurrentMonthProjection();
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
    projGrowth.addEventListener('input', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
    projGrowth.addEventListener('change', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
  }
  if (projCommission) {
    projCommission.addEventListener('input', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
    projCommission.addEventListener('change', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
  }
  if (projSafety) {
    projSafety.addEventListener('input', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
    projSafety.addEventListener('change', () => { calculateAndRenderCurrentMonthProjection(); calculateAndRenderProjection(); });
  }
  
  const chkIncludeInflows = document.getElementById('chk-include-inflows');
  if (chkIncludeInflows) {
    chkIncludeInflows.addEventListener('change', () => {
      calculateAndRenderCurrentMonthProjection();
      calculateAndRenderProjection();
    });
  }
}

// ---- Combined Filter Change Handler ----
async function handleFilterChange() {
  if (currentMainTab === 'commissions') {
    await loadDashboard();
  } else if (currentMainTab === 'operational') {
    await loadOperationalReports();
  } else if (currentMainTab === 'financial') {
    await loadFinancialReports();
  } else if (currentMainTab === 'report') {
    await loadMonthlyReport();
  }
}

// ---- Data Synchronization (n8n Webhook & Supabase Status Polling) ----
const btnSync = document.getElementById('btn-sync');
const syncOverlay = document.getElementById('sync-overlay');
const syncSpinner = document.getElementById('sync-spinner');
const syncSuccessIcon = document.getElementById('sync-success-icon');
const syncErrorIcon = document.getElementById('sync-error-icon');
const syncStatusTitle = document.getElementById('sync-status-title');
const syncStatusDesc = document.getElementById('sync-status-desc');
const syncProgressBar = document.getElementById('sync-progress-bar');
const btnCloseSyncError = document.getElementById('btn-close-sync-error');

let syncPollInterval = null;

if (btnSync) {
  btnSync.addEventListener('click', async () => {
    // 1. Show overlay and reset UI state
    syncOverlay.style.display = 'flex';
    // Trigger CSS opacity and scale animations via Reflow
    syncOverlay.getBoundingClientRect(); 
    syncOverlay.classList.add('active');
    
    syncSpinner.style.display = 'block';
    syncSuccessIcon.style.display = 'none';
    syncErrorIcon.style.display = 'none';
    btnCloseSyncError.style.display = 'none';
    
    syncStatusTitle.innerText = "Sincronizando Dados";
    syncStatusDesc.innerText = "Iniciando a comunicação com a API do n8n...";
    syncProgressBar.className = "sync-progress-bar";
    syncProgressBar.style.width = "10%";
    
    try {
      debugLog("Chamando webhook de sincronização no n8n...");
      const response = await fetch("https://workflows.vxautomation.com.br/webhook/sync-montreal");
      
      if (!response.ok) {
        throw new Error(`N8N respondeu com código de erro ${response.status}`);
      }
      
      syncProgressBar.style.width = "20%";
      syncStatusDesc.innerText = "Conectado ao n8n! Aguardando o início dos sub-workflows...";
      
      // 3. Start Polling the Supabase Table
      startSyncPolling();
      
    } catch (err) {
      debugError("Erro ao iniciar a sincronização no n8n", err);
      showSyncError(`Não foi possível estabelecer contato com o servidor n8n: ${err.message}`);
    }
  });
}

if (btnCloseSyncError) {
  btnCloseSyncError.addEventListener('click', () => {
    syncOverlay.classList.remove('active');
    setTimeout(() => {
      syncOverlay.style.display = 'none';
    }, 300);
  });
}

function showSyncError(msg) {
  if (syncPollInterval) {
    clearInterval(syncPollInterval);
    syncPollInterval = null;
  }
  syncSpinner.style.display = 'none';
  syncSuccessIcon.style.display = 'none';
  syncErrorIcon.style.display = 'block';
  btnCloseSyncError.style.display = 'block';
  
  syncStatusTitle.innerText = "Falha na Sincronização";
  syncStatusDesc.innerText = msg;
  syncProgressBar.className = "sync-progress-bar error";
  syncProgressBar.style.width = "100%";
}

function startSyncPolling() {
  if (syncPollInterval) clearInterval(syncPollInterval);
  
  // Poll every 2 seconds
  syncPollInterval = setInterval(async () => {
    try {
      // Query the first row of mt_sync_status
      const token = getUserToken() || SUPABASE_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mt_sync_status?id=eq.1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error(`Erro ao consultar status do Supabase: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data || data.length === 0) {
        throw new Error("Tabela de status vazia no Supabase.");
      }
      
      const syncStatus = data[0];
      const status = syncStatus.status;
      const errorMessage = syncStatus.error_message;
      
      debugLog(`[Sync Poll] Status atual: "${status}"`);
      
      if (status === 'idle') {
        // SUCCESS!
        clearInterval(syncPollInterval);
        syncPollInterval = null;
        
        syncSpinner.style.display = 'none';
        syncErrorIcon.style.display = 'none';
        syncSuccessIcon.style.display = 'block';
        
        syncStatusTitle.innerText = "Sincronização Concluída!";
        syncProgressBar.className = "sync-progress-bar success";
        syncProgressBar.style.width = "100%";
        
        const lastSyncDate = syncStatus.last_sync_at ? new Date(syncStatus.last_sync_at).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR');
        syncStatusDesc.innerText = `Todos os dados foram atualizados com sucesso às ${lastSyncDate}! Recarregando o painel...`;
        
        // Reload dashboard after 2 seconds
        setTimeout(async () => {
          syncOverlay.classList.remove('active');
          setTimeout(() => {
            syncOverlay.style.display = 'none';
          }, 300);
          
          // Reload the entire dashboard data
          await loadDashboard();
          // Also clear financials cache to force reload DRE/DFC if user is on those tabs
          cachedFinancialData = null;
          const activeMainTab = document.querySelector('.main-tab-btn.active');
          if (activeMainTab && activeMainTab.id === 'main-tab-financial') {
            await loadFinancialReports();
          } else if (activeMainTab && activeMainTab.id === 'main-tab-operational') {
            await loadOperationalReports();
          }
        }, 2500);
        
      } else if (status === 'error') {
        // FAILED!
        showSyncError(errorMessage || "Erro desconhecido durante a execução das etapas no n8n.");
        
      } else if (status.startsWith('running:')) {
        // PROGRESS UPDATE!
        const stepName = status.replace('running:', '').trim();
        let progressPercent = 30;
        let descriptionText = "Processando etapas...";
        
        if (stepName === "Extrato Mercado Pago") {
          progressPercent = 30;
          descriptionText = "Etapa 1/5: Importando extratos recentes do Mercado Pago...";
        } else if (stepName === "Procfy no Supabase") {
          progressPercent = 45;
          descriptionText = "Etapa 2/5: Sincronizando lançamentos financeiros do Procfy...";
        } else if (stepName === "Atualizar Bookings") {
          progressPercent = 60;
          descriptionText = "Etapa 3/5: Sincronizando agendamentos e presenças no MatchPoint...";
        } else if (stepName === "Atualiza Clientes") {
          progressPercent = 75;
          descriptionText = "Etapa 4/5: Atualizando base cadastral de clientes ativos...";
        } else if (stepName === "Relatório de Vendas") {
          progressPercent = 90;
          descriptionText = "Etapa 5/5: Consolidando relatórios gerais de faturamento e vendas...";
        }
        
        syncProgressBar.style.width = `${progressPercent}%`;
        syncStatusDesc.innerText = descriptionText;
      }
      
    } catch (err) {
      debugError("Erro ao consultar status no loop de polling", err);
      // We don't fail immediately on single fetch errors to prevent network glitches from breaking the UI
    }
  }, 2000);
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
  const safetyRate = elSafety ? parseFloat(elSafety.value) / 100 : 0.05;

  // Build historical payment memory per customer_code
  const clientMemory = {};
  allSalesData.forEach(s => {
    const code = s.customer_code;
    if (!code) return;
    const desc = (s.item_description || '').toUpperCase();
    if (desc.includes('TÊNIS') || desc.includes('TENIS') || desc.includes('TNIS') || desc.includes('TARNIS')) {
      const val = parseFloat(s.valor_faturamento) || 0.0;
      const payMonth = s.pay_date ? s.pay_date.substring(0, 7) : '';
      if (!clientMemory[code]) {
        clientMemory[code] = {};
      }
      if (!clientMemory[code][payMonth]) {
        clientMemory[code][payMonth] = 0.0;
      }
      clientMemory[code][payMonth] += val;
    }
  });

  const clientMostRecentPayment = {};
  Object.keys(clientMemory).forEach(code => {
    const months = Object.keys(clientMemory[code]).sort((a, b) => b.localeCompare(a));
    if (months.length > 0) {
      clientMostRecentPayment[code] = clientMemory[code][months[0]];
    }
  });

  const monthsFullBR = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const targetMonths = [];
  const currentMonthInt = parseInt(month, 10);
  const currentYearInt = parseInt(year, 10);

  for (let i = 1; i <= 3; i++) {
    let m = currentMonthInt + i;
    let y = currentYearInt;
    if (m > 12) {
      m -= 12;
      y += 1;
    }
    const mStr = String(m).padStart(2, '0');
    const label = `${monthsFullBR[m - 1]}/${y}`;
    const key = `${y}-${mStr}`;
    const monthStart = `${y}-${mStr}-01`;
    const monthEnd = getEndOfMonth(monthStart);
    targetMonths.push({ key, label, monthStart, monthEnd });
  }

  const round2 = val => Math.round(val * 100) / 100;
  
  const baseMonthPrefix = `${year}-${month}`;
  const todayForBaseline = new Date();
  const todayYearForBaseline = todayForBaseline.getFullYear();
  const todayMonthForBaseline = todayForBaseline.getMonth() + 1;
  const isJunho2026 = (baseMonthPrefix === '2026-06');
  const isCurrentMonth = (parseInt(year, 10) === todayYearForBaseline && parseInt(month, 10) === todayMonthForBaseline) && !isJunho2026;

  const baselineMonthPrefix = (() => {
    if (isCurrentMonth) {
      let prevM = parseInt(month, 10) - 1;
      let prevY = parseInt(year, 10);
      if (prevM === 0) {
        prevM = 12;
        prevY -= 1;
      }
      return `${prevY}-${String(prevM).padStart(2, '0')}`;
    } else {
      return baseMonthPrefix;
    }
  })();

  const baselineYear = parseInt(baselineMonthPrefix.split('-')[0], 10);
  const baselineMonth = parseInt(baselineMonthPrefix.split('-')[1], 10);

  // Filter base month bookings
  const juneBookings = allCommData.filter(row => row.booking_date && row.booking_date.startsWith(baselineMonthPrefix));
  
  // Calculate next month start date format YYYY-MM-01
  const nextMonthStart = (() => {
    const d = new Date(monthStart + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0].substring(0, 8) + '01';
  })();

  // Use all retrieved historical data (6-month window) to compute the payment method ratios dynamically
  const basePayments = allPaymentMethodsData;
  const baseMp = allMpPaymentsData;

  // Calculate the online credit card ratio in the base month using baseMp
  let mpPix = 0;
  let mpCredit = 0;
  let mpSaldo = 0;
  let mpOther = 0;
  
  baseMp.forEach(p => {
    const amt = parseFloat(p.transaction_amount) || 0;
    const type = p.payment_type_id;
    const method = p.payment_method_id;
    
    if (type === 'bank_transfer' || method === 'pix') {
      mpPix += amt;
    } else if (type === 'credit_card') {
      mpCredit += amt;
    } else if (type === 'account_money') {
      mpSaldo += amt;
    } else {
      mpOther += amt;
    }
  });
  
  const mpTotal = mpPix + mpCredit + mpSaldo + mpOther;

  let localCredit = 0;
  let localTarjeta = 0;
  let localDebit = 0;
  let localEfectivo = 0;
  let localTransfer = 0;
  let onlineTotal = 0;

  basePayments.forEach(p => {
    const method = (p.pay_method || '').toLowerCase();
    const amt = parseFloat(p.amount) || 0;

    if (method.includes('credito') || method.includes('crédito')) {
      localCredit += amt;
    } else if (method === 'tarjeta') {
      localTarjeta += amt;
    } else if (method.includes('debito') || method.includes('débito')) {
      localDebit += amt;
    } else if (method === 'efectivo') {
      localEfectivo += amt;
    } else if (method === 'transferencia' || method === 'pix') {
      localTransfer += amt;
    } else if (method === 'pagamento online') {
      onlineTotal += amt;
    }
  });

  let onlineCredit = 0;
  let onlineD0 = 0;

  if (onlineTotal > 0) {
    if (mpTotal > 0) {
      onlineCredit = onlineTotal * (mpCredit / mpTotal);
      onlineD0 = onlineTotal * ((mpPix + mpSaldo + mpOther) / mpTotal);
    } else {
      onlineCredit = onlineTotal * 0.70;
      onlineD0 = onlineTotal * 0.30;
    }
  }

  const totalBaseFaturamento = localCredit + localTarjeta + localDebit + localEfectivo + localTransfer + onlineTotal;
  const totalBaseD30 = localCredit + localTarjeta + onlineCredit;
  const baseD30Ratio = totalBaseFaturamento > 0 ? (totalBaseD30 / totalBaseFaturamento) : 0.70;
  const baseD0Ratio = 1 - baseD30Ratio;

  // Calculate student slot values in base month
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
      const descUpper = (b.description || '').toUpperCase();
      const isFree = b.booking_type === 'clase_suelta' ||
                     descUpper.includes('REPOSIÇÃO') ||
                     descUpper.includes('REPOSICAO') ||
                     descUpper.includes('EXPERIMENTAL') ||
                     descUpper.includes('CORTESIA') ||
                     descUpper.includes('TESTE');
      
      if (isFree) {
        juneUnpaidEstimatedValues[b.booking_id] = 0.0;
        return;
      }

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
        const nTotal = getWeekdayOccurrencesInMonth(baselineYear, baselineMonth, slot.dayOfWeek);
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
  
  const slotsBaselineMonthPrefix = baseMonthPrefix;
  const slotsBookings = allCommData.filter(row => row.booking_date && row.booking_date.startsWith(slotsBaselineMonthPrefix));
  const monthlySlotsBookings = slotsBookings.filter(b => b.booking_type !== 'clase_suelta');
  
  // Group bookings by student
  const bookingsByStudent = {};
  monthlySlotsBookings.forEach(b => {
    const studentName = b.participant_name || 'Desconhecido';
    if (!bookingsByStudent[studentName]) {
      bookingsByStudent[studentName] = [];
    }
    bookingsByStudent[studentName].push(b);
  });
  
  Object.keys(bookingsByStudent).forEach(studentName => {
    const listB = bookingsByStudent[studentName];
    const code = listB[0].customer_code;
    
    // 1. Check historical price memory
    if (code && clientMostRecentPayment[code] !== undefined) {
      const val = clientMostRecentPayment[code];
      if (val > 0) {
        activeJuneSlots.push({
          studentName,
          customerCode: code,
          monthlyPrice: val,
          isHistorical: true
        });
      }
    } else {
      // 2. New student: calculate frequency from calendar and apply package rules
      const slots = {};
      listB.forEach(b => {
        const descUpper = (b.description || '').toUpperCase();
        const isFree = descUpper.includes('REPOSIÇÃO') ||
                       descUpper.includes('REPOSICAO') ||
                       descUpper.includes('EXPERIMENTAL') ||
                       descUpper.includes('CORTESIA') ||
                       descUpper.includes('TESTE');
        if (isFree) return;
        
        const dateObj = new Date(b.booking_date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const startTime = b.start_time || '00:00';
        const pricingInfo = getBasePriceForBooking(b);
        const slotKey = `${dayOfWeek}_${startTime}`;
        slots[slotKey] = pricingInfo;
      });
      
      const uniqueSlots = Object.values(slots);
      const nSlots = uniqueSlots.length;
      if (nSlots > 0) {
        const mainCategory = uniqueSlots[0].category;
        let price = 0.0;
        
        if (mainCategory.includes('Individual')) {
          if (nSlots === 1) price = 720.0;
          else if (nSlots === 2) price = 1296.0;
          else price = 1836.0;
        } else if (mainCategory.includes('Dupla')) {
          if (nSlots === 1) price = 430.0;
          else if (nSlots === 2) price = 774.0;
          else price = 1096.50;
        } else if (mainCategory.includes('Trio')) {
          if (nSlots === 1) price = 395.0;
          else if (nSlots === 2) price = 711.0;
          else price = 1007.25;
        } else { // Grupo
          if (nSlots === 1) price = 335.0;
          else if (nSlots === 2) price = 603.0;
          else price = 854.25;
        }
        
        // Apply discounts if any booking has socio/offpeak keywords
        let discountRate = 0;
        let hasSocio = false;
        let hasOffPeak = false;
        
        listB.forEach(b => {
          const desc = (b.description || '').toUpperCase();
          const dateObj = new Date(b.booking_date + 'T00:00:00');
          const dayOfWeek = dateObj.getDay();
          const startTime = b.start_time || '00:00';
          const isOffPeak = dayOfWeek >= 1 && dayOfWeek <= 5 && 
                            (parseInt(startTime.split(':')[0], 10) >= 10 && parseInt(startTime.split(':')[0], 10) <= 15);
                            
          if (desc.includes('SÓCIO') || desc.includes('SOCIO') || b.is_socio_benefit) {
            hasSocio = true;
          } else if (desc.includes('HORA LIGHT') || isOffPeak) {
            hasOffPeak = true;
          }
        });
        
        if (hasSocio) discountRate = 0.50;
        else if (hasOffPeak) discountRate = 0.12;
        
        price = price * (1 - discountRate);
        
        activeJuneSlots.push({
          studentName,
          customerCode: code,
          monthlyPrice: price,
          isHistorical: false
        });
      }
    }
  });

  const junePaidFinal = (monthlyData[baselineMonthPrefix] && monthlyData[baselineMonthPrefix].final) || 7280.98;

  // ---- Get real current bank balance (same source as daily projection) ----
  let currentActualCashBalance3M = junePaidFinal; // fallback to DFC if no real data
  if (allProcfyData && allProcfyData.length > 0) {
    const sortedBySync = [...allProcfyData].sort((a, b) => {
      const dateA = a.synced_at || '';
      const dateB = b.synced_at || '';
      return dateB.localeCompare(dateA);
    });
    if (sortedBySync[0] && sortedBySync[0].bank_account_balance_cents !== undefined) {
      currentActualCashBalance3M = sortedBySync[0].bank_account_balance_cents / 100;
    }
  }
  
  // Consolidate with investment account balance if we are in July 2026 or later
  const todayDateFor3MCheck = new Date();
  const currentYearMonthFor3M = `${todayDateFor3MCheck.getFullYear()}-${String(todayDateFor3MCheck.getMonth() + 1).padStart(2, '0')}`;
  if (currentYearMonthFor3M >= '2026-07') {
    currentActualCashBalance3M += calculateInvestmentBalance(allInterData);
  }

  // Today's date string for filtering only FUTURE unpaid transactions
  const todayDateFor3M = new Date();
  const todayStrFor3M = `${todayDateFor3M.getFullYear()}-${String(todayDateFor3M.getMonth() + 1).padStart(2, '0')}-${String(todayDateFor3M.getDate()).padStart(2, '0')}`;

  // Only count unpaid inflows/outflows from today onwards (already in bank balance for past days)
  let juneRemainingUnpaidInflowsD0 = 0.0;
  let juneRemainingUnpaidInflowsD30 = 0.0;

  juneBookings.forEach(b => {
    if (b.is_paid) return;
    if (b.booking_date && b.booking_date < todayStrFor3M) return; // skip past unpaid
    let val = (juneUnpaidEstimatedValues[b.booking_id] || 0.0) * UNPAID_RECOVERY_RATE;
    juneRemainingUnpaidInflowsD0 += val * baseD0Ratio;
    juneRemainingUnpaidInflowsD30 += val * baseD30Ratio;
  });

  let juneRemainingUnpaidOutflowsOps = 0.0;
  let juneRemainingUnpaidOutflowsInv = 0.0;
  let juneRemainingUnpaidInflowsProcfy = 0.0;

  // The cutoff for "overdue" is the start of the first projected month.
  // A July 1st expense must NOT be counted as overdue because it is already
  // picked up by procfyScheduledTxList for July (double-counting).
  const firstProjectedMonthStart = targetMonths[0].monthStart; // e.g. "2026-07-01"

  allProcfyData.forEach(tx => {
    const dateStr = tx.due_date;
    if (!dateStr) return;
    if (tx.paid) return;

    const amount = parseFloat(tx.amount) || 0.0;
    if (tx.transaction_type === 'revenue') {
      // Only include future unpaid revenues for the BASE month
      if (dateStr.startsWith(baseMonthPrefix) && dateStr >= todayStrFor3M) {
        juneRemainingUnpaidInflowsProcfy += amount;
      }
    } else {
      // Include ALL unpaid outflows due BEFORE the first projected month (they are overdue)
      if (dateStr < firstProjectedMonthStart) {
        if (tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos') {
          juneRemainingUnpaidOutflowsInv += amount;
        } else {
          juneRemainingUnpaidOutflowsOps += amount;
        }
      }
    }
  });

  // Backward compat alias
  const juneRemainingUnpaidOutflows = round2(juneRemainingUnpaidOutflowsOps + juneRemainingUnpaidOutflowsInv);


  // July opening balance = the final balance from the daily (current month) projection
  // That projection already accounts for all real-bank-balance + future inflows - future outflows + commissions
  // It is computed in calculateAndRenderCurrentMonthProjection() which runs first
  const julyOpeningBalance = (typeof cachedMonthEndProjectionBalance === 'number' && !isNaN(cachedMonthEndProjectionBalance))
    ? cachedMonthEndProjectionBalance
    : ((monthlyData[baseMonthPrefix] && monthlyData[baseMonthPrefix].final) || 7280.98);
  
  const juneSalesTotal = allSalesData.filter(s => s.pay_date && s.pay_date.startsWith(baselineMonthPrefix))
                                     .reduce((sum, s) => sum + (parseFloat(s.valor_faturamento) || 0.0), 0.0);
  const junePaidTuition = juneBookings.filter(b => b.is_paid)
                                      .reduce((sum, b) => sum + (parseFloat(b.booking_value) || 0.0), 0.0);
  const juneVariableRevenueBaseline = Math.max(0.0, juneSalesTotal - junePaidTuition);

  const juneFixedExpensesBaseline = (dreData[baselineMonthPrefix] ? dreData[baselineMonthPrefix].energia : 0.0) +
                                    (dreData[baselineMonthPrefix] ? dreData[baselineMonthPrefix].despesasOperacionais : 0.0);

  const projectionResults = {};
  
  const rollingVariableRevenues = [juneVariableRevenueBaseline];
  const rollingFixedExpenses = [juneFixedExpensesBaseline];

  // Capacity parameters calculation from base month (June 2026)
  const baseCourtOccupancy = isCurrentMonth ? (cachedFinancialData.prevCourtOccupancy || []) : (cachedFinancialData.baseCourtOccupancy || []);
  const baseHourlyEfficiency = isCurrentMonth ? (cachedFinancialData.prevHourlyEfficiency || []) : (cachedFinancialData.baseHourlyEfficiency || []);

  const courtNames = new Set(baseCourtOccupancy.map(d => d.resource_name).filter(Boolean));
  const numCourts = Math.max(courtNames.size, 4);

  let baseMaintHours = 0;
  let baseFixedHours = 0;
  let baseAvulsaHours = 0;
  let baseRentalHours = 0;

  if (baseCourtOccupancy.length > 0) {
    baseCourtOccupancy.forEach(item => {
      const tipo = (item.tipo_operacional || '').toLowerCase();
      const hours = parseFloat(item.horas_ocupadas) || 0;
      const isMaint = tipo.includes('manutenção') || tipo.includes('bloqueio') || tipo.includes('manutencao');
      
      if (isMaint) {
        baseMaintHours += hours;
      } else if (tipo.startsWith('aulas - regular') || tipo.includes('reserva mensal') || tipo.startsWith('aulas - adulto') || tipo.startsWith('aulas - kids') || tipo === 'outros') {
        baseFixedHours += hours;
      } else if (tipo.includes('locação - quadra avulsa')) {
        baseRentalHours += hours;
      } else if (tipo.includes('aulas - avulsa particular')) {
        baseAvulsaHours += hours;
      }
    });
  } else {
    // Fallback if data not loaded
    baseMaintHours = 447.0;
    baseFixedHours = 242.0;
    baseAvulsaHours = 31.0;
    baseRentalHours = 140.50;
  }

  const rentalEff = baseHourlyEfficiency.find(d => (d.tipo_operacional || '').toLowerCase().includes('locação - quadra avulsa'));
  const ticketMedioLocacao = rentalEff ? parseFloat(rentalEff.faturamento_por_hora_ocupada) : 111.28;

  const baseCapacityHours = calcTotalAvailableHoursForMonth(baselineYear, baselineMonth) * numCourts;
  const baseFreeHours = Math.max(0, baseCapacityHours - baseMaintHours - baseFixedHours - baseAvulsaHours);
  const baseRentalOccupancyRate = baseFreeHours > 0 ? (baseRentalHours / baseFreeHours) : 0.1641;

  const baseRentalRevenue = baseRentalHours * ticketMedioLocacao;
  const baseOtherVarRevenue = Math.max(0.0, juneVariableRevenueBaseline - baseRentalRevenue);

  const juneD30TuitionTotal = juneBookings.map(b => {
    const val = b.is_paid ? (parseFloat(b.booking_value) || 0.0) : ((juneUnpaidEstimatedValues[b.booking_id] || 0.0) * UNPAID_RECOVERY_RATE);
    return val * baseD30Ratio;
  }).reduce((sum, val) => sum + val, 0.0);

  let prevD30Tuition = juneD30TuitionTotal;
  let prevD30Variable = juneVariableRevenueBaseline * baseD30Ratio; 

  let prevMonthFinalBalance = julyOpeningBalance;

  const calculationMonths = [];
  if (isCurrentMonth) {
    calculationMonths.push({
      key: baseMonthPrefix,
      label: `${monthsFullBR[currentMonthInt - 1]}/${currentYearInt}`,
      monthStart: `${currentYearInt}-${String(currentMonthInt).padStart(2, '0')}-01`,
      monthEnd: getEndOfMonth(`${currentYearInt}-${String(currentMonthInt).padStart(2, '0')}-01`),
      isHidden: true
    });
  }
  targetMonths.forEach(m => {
    calculationMonths.push({ ...m, isHidden: false });
  });

  calculationMonths.forEach((m, idx) => {
    const mKey = m.key;
    const curYearStr = mKey.substring(0, 4);
    const curMonthStr = mKey.substring(5, 7);
    const monthIndex = idx + 1;

    let baseTuitionVal = 0.0;
    activeJuneSlots.forEach(slot => {
      baseTuitionVal += slot.monthlyPrice;
    });

    const tuitionGenerated = round2(baseTuitionVal * Math.pow(1 + growthRate, monthIndex));
    const tuitionD0 = round2(tuitionGenerated * baseD0Ratio);
    const tuitionD30 = round2(tuitionGenerated * baseD30Ratio);

    const projCapacityHours = calcTotalAvailableHoursForMonth(parseInt(curYearStr, 10), parseInt(curMonthStr, 10)) * numCourts;
    const projFixedHours = baseFixedHours * Math.pow(1 + growthRate, monthIndex);
    const projAvulsaHours = baseAvulsaHours;
    const projMaintHours = baseMaintHours;

    const projFreeHours = Math.max(0, projCapacityHours - projMaintHours - projFixedHours - projAvulsaHours);
    const projOccupancyRate = Math.min(0.35, baseRentalOccupancyRate * Math.pow(1 + 0.05, monthIndex));
    
    const projRentalHours = projFreeHours * projOccupancyRate;
    const projRentalRevenue = projRentalHours * ticketMedioLocacao;
    const projOtherVarRevenue = baseOtherVarRevenue * Math.pow(1 + growthRate, monthIndex);

    const projectedVarRevenue = round2(projRentalRevenue + projOtherVarRevenue);
    rollingVariableRevenues.push(projectedVarRevenue);

    let varD0 = round2(projectedVarRevenue * baseD0Ratio);
    let varD30 = round2(projectedVarRevenue * baseD30Ratio);

    const tuitionReceivedD0 = tuitionD0;
    const variableReceivedD0 = varD0;

    let tuitionReceivedD30 = prevD30Tuition;
    let variableReceivedD30 = prevD30Variable;

    // Apply imported receivables agenda as D-30 override if available for this month
    const importedForMonth = (allImportedReceivablesData || []).filter(r => r.data_liberacao && r.data_liberacao.startsWith(mKey));
    if (importedForMonth.length > 0) {
      const totalImportedForMonth = importedForMonth.reduce((sum, r) => sum + (parseFloat(r.valor) || 0.0), 0.0);
      const totalPlannedD30 = prevD30Tuition + prevD30Variable;
      const tuitionShare = totalPlannedD30 > 0 ? (prevD30Tuition / totalPlannedD30) : 0.84;
      
      tuitionReceivedD30 = round2(totalImportedForMonth * tuitionShare);
      variableReceivedD30 = round2(totalImportedForMonth * (1 - tuitionShare));
      debugLog(`[PROJ MENSAL] Override de agenda aplicado para ${mKey}: R$ ${totalImportedForMonth.toFixed(2)} (Aulas: R$ ${tuitionReceivedD30.toFixed(2)}, Locações: R$ ${variableReceivedD30.toFixed(2)})`);
    }

    const totalInflow = round2(tuitionReceivedD0 + tuitionReceivedD30 + variableReceivedD0 + variableReceivedD30);

    const nextPrevD30Tuition = tuitionD30;
    const nextPrevD30Variable = varD30;

    if (m.isHidden) {
      prevD30Tuition = nextPrevD30Tuition;
      prevD30Variable = nextPrevD30Variable;
      return;
    }

    prevD30Tuition = nextPrevD30Tuition;
    prevD30Variable = nextPrevD30Variable;

    const procfyScheduledTxList = allProcfyData.filter(tx => {
      const dateStr = tx.due_date;
      return dateStr && dateStr.startsWith(mKey) && !tx.paid && tx.transaction_type !== 'revenue';
    });

    const procfyScheduledOps = procfyScheduledTxList
      .filter(tx => tx.cost_center_name !== 'Investimentos' && tx.cost_center_descricao !== 'Investimentos')
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

    const procfyScheduledInv = procfyScheduledTxList
      .filter(tx => tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos')
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

    // Add overdue base-month outflows to the first projected month
    // If it is the current month, they are already handled by the current month's daily DFC projection, so we set them to 0.0 to prevent double-counting.
    const overdueOpsAdj = (idx === 0 && !isCurrentMonth) ? juneRemainingUnpaidOutflowsOps : 0.0;
    const overdueInvAdj = (idx === 0 && !isCurrentMonth) ? juneRemainingUnpaidOutflowsInv : 0.0;

    const procfyScheduledOpsRounded = round2(procfyScheduledOps + overdueOpsAdj);
    const procfyScheduledInvRounded = round2(procfyScheduledInv + overdueInvAdj);

    // totalFixedProvision is fully controlled by the safetyRate slider.
    // baseProvision covers the gap between historical avg and scheduled expenses,
    // but only applies when the safety rate > 0. This way 0% slider = zero provision.
    const avgFixedExpenses = rollingFixedExpenses.reduce((s, v) => s + v, 0) / rollingFixedExpenses.length;
    const effectiveBase = Math.max(procfyScheduledOpsRounded, avgFixedExpenses);
    const totalFixedProvision = round2(effectiveBase * safetyRate);

    const totalMonthFixedExpenses = procfyScheduledOpsRounded + totalFixedProvision;
    rollingFixedExpenses.push(totalMonthFixedExpenses);

    const commissionPaid = round2(tuitionGenerated * commissionRate);

    let tuitionFees = 0.0;
    tuitionFees += tuitionReceivedD30 * 0.025; // Adjusted to 2.5% (Mercado Pago / Card Credit)

    activeJuneSlots.forEach(slot => {
      const slotVal = round2(slot.monthlyPrice * (1 + growthRate));
      
      const payments = allPaymentMethodsData.filter(p => p.customer_code === slot.customerCode);
      const isDebit = payments.some(p => (p.pay_method || '').toLowerCase() === 'cartão débito');
      
      if (isDebit) {
        tuitionFees += (slotVal * baseD0Ratio) * 0.0099;
      }
    });

    const variableFees = (variableReceivedD30 * 0.025); // Adjusted to 2.5%

    const totalFees = round2(tuitionFees + variableFees);

    const totalOutflowOps = round2(procfyScheduledOpsRounded + totalFixedProvision + commissionPaid + totalFees);
    const netFlowOps = round2(totalInflow - totalOutflowOps);

    const netFlow = round2(netFlowOps - procfyScheduledInvRounded);
    const finalBalance = round2(prevMonthFinalBalance + netFlow);

    projectionResults[mKey] = {
      initialBalance: prevMonthFinalBalance,
      tuitionReceivedD0,
      tuitionReceivedD30,
      variableReceivedD0,
      variableReceivedD30,
      totalInflow,
      procfyScheduledOps: procfyScheduledOpsRounded,
      procfyScheduledInv: procfyScheduledInvRounded,
      fixedProvision: totalFixedProvision,
      commissionPaid,
      processingFees: totalFees,
      totalOutflowOps,
      netFlowOps,
      netFlow,
      finalBalance,
      tuitionGenerated,
      projectedVarRevenue,
      totalBilling: round2(tuitionGenerated + projectedVarRevenue),
      overdueOpsIncluded: overdueOpsAdj,
      overdueInvIncluded: overdueInvAdj
    };
    
    if (idx === 0) {
      console.log('--- MONTHLY DFC DEBUG ---');
      console.log('Total Inflow:', totalInflow);
      console.log('Total Outflow Ops:', totalOutflowOps);
      console.log('Total Outflow Inv:', procfyScheduledInvRounded);
      console.log('Final Balance:', finalBalance);
      console.log('Components: tuitionGenerated', tuitionGenerated, 'commissionPaid', commissionPaid, 'overdueOpsAdj', overdueOpsAdj, 'procfyScheduledOpsRounded', procfyScheduledOpsRounded, 'totalFixedProvision', totalFixedProvision, 'totalFees', totalFees);
    }

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
  
  html += `<tr class="flow-header-row" data-target="proj-entradas-child-row"><td><span class="arrow-indicator">▼</span>(+) Entradas de Caixa</td>` + 
          targetMonths.map(m => `<td class="text-right text-inflow">${formatCurrency(projectionResults[m.key].totalInflow)}</td>`).join('') + `</tr>`;
  
  html += makeProjRowHtml('Mensalidades (Recebimento D-0)', ['proj-entradas-child-row', 'fco-child-row'], r => r.tuitionReceivedD0);
  html += makeProjRowHtml('Mensalidades (Recebimento D-30)', ['proj-entradas-child-row', 'fco-child-row'], r => r.tuitionReceivedD30);
  html += makeProjRowHtml('Locações e Outros (Recebimento D-0)', ['proj-entradas-child-row', 'fco-child-row'], r => r.variableReceivedD0);
  html += makeProjRowHtml('Locações e Outros (Recebimento D-30)', ['proj-entradas-child-row', 'fco-child-row'], r => r.variableReceivedD30);

  html += `<tr class="flow-header-row" data-target="proj-saidas-ops-child-row"><td><span class="arrow-indicator">▼</span>(-) Saídas Operacionais</td>` + 
          targetMonths.map(m => `<td class="text-right text-outflow">-${formatCurrency(projectionResults[m.key].totalOutflowOps)}</td>`).join('') + `</tr>`;
  
  html += makeProjRowHtml('Despesas Agendadas (Procfy)', ['proj-saidas-ops-child-row', 'fco-child-row'], r => -r.procfyScheduledOps, true);
  html += makeProjRowHtml('Provisão de Custos Recorrentes', ['proj-saidas-ops-child-row', 'fco-child-row'], r => -r.fixedProvision, true);
  html += makeProjRowHtml('Comissões de Professores', ['proj-saidas-ops-child-row', 'fco-child-row'], r => -r.commissionPaid, true);
  html += makeProjRowHtml('Taxas de Processamento', ['proj-saidas-ops-child-row', 'fco-child-row'], r => -r.processingFees, true);

  html += makeProjRowHtml('(=) Geração de Caixa Operacional', ['dfc-balance-row'], r => r.netFlowOps, true, true);

  html += `<tr class="flow-header-row fci-header" data-target="proj-saidas-inv-child-row"><td><span class="arrow-indicator">▼</span>(-) Saídas de Investimento</td>` + 
          targetMonths.map(m => `<td class="text-right text-outflow">-${formatCurrency(projectionResults[m.key].procfyScheduledInv)}</td>`).join('') + `</tr>`;

  html += makeProjRowHtml('Investimentos Agendados (Procfy)', ['proj-saidas-inv-child-row', 'fco-child-row'], r => -r.procfyScheduledInv, true);

  html += makeProjRowHtml('(=) Fluxo Líquido do Mês', ['dfc-balance-row'], r => r.netFlow, true, true);
  html += makeProjRowHtml('Saldo Final (Caixa)', ['dfc-balance-row'], r => r.finalBalance);

  const tbody = document.getElementById('fin-projection-body');
  if (tbody) {
    tbody.innerHTML = html;
  }

  // Render projected billing summary cards
  const billingGrid = document.getElementById('proj-billing-grid');
  if (billingGrid) {
    billingGrid.innerHTML = targetMonths.map(m => {
      const res = projectionResults[m.key];
      return `
        <div class="billing-card" style="flex: 1; min-width: 240px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">${m.label}</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">${formatCurrency(res.totalBilling)}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.35rem;">
            <span>Mensalidades (Competência):</span>
            <span style="font-weight: 600; color: var(--text-main);">${formatCurrency(res.tuitionGenerated)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-muted);">
            <span>Locações e Outros (Média):</span>
            <span style="font-weight: 600; color: var(--text-main);">${formatCurrency(res.projectedVarRevenue)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Register collapse event handlers for Projection Table
  document.querySelectorAll('#fin-projection-table .flow-header-row').forEach(row => {
    row.addEventListener('click', () => {
      const targetClass = row.getAttribute('data-target');
      const isCollapsed = row.classList.toggle('collapsed');
      document.querySelectorAll('#fin-projection-table .' + targetClass).forEach(child => {
        child.style.display = isCollapsed ? 'none' : '';
      });
      const arrow = row.querySelector('.arrow-indicator');
      if (arrow) {
        arrow.innerText = isCollapsed ? '▶' : '▼';
      }
    });
  });
}

function get30DaysBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function calculateGlobalPendingCommissionsForMonth(year, month) {
  if (!cachedFinancialData || !cachedFinancialData.allCommData || !cachedFinancialData.allGlobalPayoutsData) return 0.0;
  
  const allCommData = cachedFinancialData.allCommData;
  const allGlobalPayoutsData = cachedFinancialData.allGlobalPayoutsData;
  const allVouchersData = cachedFinancialData.allVouchersData || [];
  const monthPrefix = `${year}-${month}`;
  
  const classesData = allCommData.filter(row => {
    const bDate = row.booking_date;
    const pDate = row.pay_date;
    return (bDate && bDate.startsWith(monthPrefix)) || (pDate && pDate.startsWith(monthPrefix));
  });

  let totalPaidCommission = 0.0;

  classesData.forEach(row => {
    const isPaidInSelectedMonth = row.is_paid && row.pay_date && row.pay_date.startsWith(monthPrefix);
    if (isPaidInSelectedMonth) {
      const val = parseFloat(row.booking_value) || 0;
      const rawBase = parseFloat(row.booking_commission_base) || val;
      const commBase = getAdjustedCommissionBase(row, rawBase);
      if (val > 0) {
        totalPaidCommission += commBase * (getRateForTeacher(row.professor) / 100);
      }
    }
  });

  // Add paid Intensivão vouchers commission
  const filteredVouchers = allVouchersData.filter(v => {
    const prof = parseVoucherProfessor(v.description || '');
    return prof && parseFloat(v.total) > 0 && !/anula/i.test(v.description || '');
  });

  filteredVouchers.forEach(v => {
    const prof = parseVoucherProfessor(v.description || '');
    const val = parseFloat(v.total) || 0.0;
    const payDateStr = v.pay_date ? v.pay_date.substring(0, 7) : '';
    if (payDateStr === monthPrefix) {
      const rate = getRateForTeacher(prof);
      totalPaidCommission += val * (rate / 100);
    }
  });

  const paidCommissionVal = totalPaidCommission;

  let totalPayouts = 0.0;
  allGlobalPayoutsData.forEach(p => {
    if (p.reference_period && p.reference_period.startsWith(monthPrefix)) {
      totalPayouts += parseFloat(p.amount) || 0.0;
    }
  });

  return Math.max(0.0, paidCommissionVal - totalPayouts);
}


function calculateAndRenderCurrentMonthProjection() {
  if (!cachedFinancialData) {
    debugLog("Sem dados financeiros cacheados para a projeção do mês atual.");
    return;
  }

  try {

  const {
    allProcfyData,
    allInterData,
    allSalesData,
    allCommData,
    allPaymentMethodsData,
    allMpPaymentsData,
    allGlobalPayoutsData,
    allVouchersData,
    allImportedReceivablesData,
    prevCourtOccupancy,
    prevHourlyEfficiency,
    monthStart,
    monthEnd,
    year,
    month,
    monthlyData,
    dreData
  } = cachedFinancialData;

  const round2 = val => Math.round(val * 100) / 100;

  // 1. Determine "Today" context for the current month.
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const selectedYearInt = parseInt(year, 10);
  const selectedMonthInt = parseInt(month, 10);

  let startDay = 1;
  let isCurrentRealMonth = false;

  if (selectedYearInt === currentYear && selectedMonthInt === currentMonth) {
    startDay = currentDay;
    isCurrentRealMonth = true;
  } else if (selectedYearInt < currentYear || (selectedYearInt === currentYear && selectedMonthInt < currentMonth)) {
    const daysInSelMonth = new Date(selectedYearInt, selectedMonthInt, 0).getDate();
    startDay = daysInSelMonth + 1;
  } else {
    startDay = 1;
  }

  const daysInMonth = new Date(selectedYearInt, selectedMonthInt, 0).getDate();
  const baseMonthPrefix = `${year}-${month}`;
  const todayStr = `${year}-${month}-${String(startDay).padStart(2, '0')}`;

  const elGrowth = document.getElementById('proj-input-growth');
  const elCommission = document.getElementById('proj-input-commission');

  const growthRate = elGrowth ? parseFloat(elGrowth.value) / 100 : 0.0;
  const commissionRate = elCommission ? parseFloat(elCommission.value) / 100 : 0.47;

  const nextMonthStart = (() => {
    const d = new Date(monthStart + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0].substring(0, 8) + '01';
  })();

  const prevMonthPrefix = (() => {
    const d = new Date(monthStart + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0].substring(0, 7);
  })();
  const projBaseMonthPrefix = prevMonthPrefix; // "2026-06"

  // Use the entire loaded payment methods dataset to compute ratios, identical to Monthly DFC
  const basePayments = allPaymentMethodsData;
  const baseMp = allMpPaymentsData;

  let mpPix = 0, mpCredit = 0, mpSaldo = 0, mpOther = 0;
  baseMp.forEach(p => {
    const amt = parseFloat(p.transaction_amount) || 0;
    const type = p.payment_type_id;
    const method = p.payment_method_id;
    if (type === 'bank_transfer' || method === 'pix') mpPix += amt;
    else if (type === 'credit_card') mpCredit += amt;
    else if (type === 'account_money') mpSaldo += amt;
    else mpOther += amt;
  });
  const mpTotal = mpPix + mpCredit + mpSaldo + mpOther;

  let localCredit = 0, localTarjeta = 0, localDebit = 0, localEfectivo = 0, localTransfer = 0, onlineTotal = 0;
  basePayments.forEach(p => {
    const method = (p.pay_method || '').toLowerCase();
    const amt = parseFloat(p.amount) || 0;
    if (method.includes('credito') || method.includes('crédito')) localCredit += amt;
    else if (method === 'tarjeta') localTarjeta += amt;
    else if (method.includes('debito') || method.includes('débito')) localDebit += amt;
    else if (method === 'efectivo') localEfectivo += amt;
    else if (method === 'transferencia' || method === 'pix') localTransfer += amt;
    else if (method === 'pagamento online') onlineTotal += amt;
  });

  let onlineCredit = 0;
  if (onlineTotal > 0) {
    if (mpTotal > 0) onlineCredit = onlineTotal * (mpCredit / mpTotal);
    else onlineCredit = onlineTotal * 0.70;
  }
  const totalBaseFaturamento = localCredit + localTarjeta + localDebit + localEfectivo + localTransfer + onlineTotal;
  const totalBaseD30 = localCredit + localTarjeta + onlineCredit;
  const baseD30Ratio = totalBaseFaturamento > 0 ? (totalBaseD30 / totalBaseFaturamento) : 0.70;
  const baseD0Ratio = 1 - baseD30Ratio;

  // ── PREV MONTH (base for projection) ──────────────────────────────

  // =========================================================================
  // GUARANTEED EXACT MATCH WITH MONTHLY DFC FOR THE BASE MONTH
  // We will re-run the exact same data aggregation logic used by the 3-month projection
  // =========================================================================
  
  const mKey = `${year}-${month}`; // "2026-07"
  
  // Re-build active slots exactly as Monthly DFC
  const monthlyJuneBookings = allCommData.filter(row => row.booking_date && row.booking_date.startsWith(projBaseMonthPrefix) && row.booking_type !== 'clase_suelta');
  
  const juneUnpaidByStudent = {};
  allCommData.filter(row => row.booking_date && row.booking_date.startsWith(projBaseMonthPrefix)).forEach(b => {
    if (!b.is_paid) {
      const studentName = b.participant_name || 'Desconhecido';
      if (!juneUnpaidByStudent[studentName]) juneUnpaidByStudent[studentName] = [];
      juneUnpaidByStudent[studentName].push(b);
    }
  });

  const juneUnpaidEstimatedValues = {};
  Object.keys(juneUnpaidByStudent).forEach(studentName => {
    const bookings = juneUnpaidByStudent[studentName];
    const slots = {};
    bookings.forEach(b => {
      const descUpper = (b.description || '').toUpperCase();
      const isFree = b.booking_type === 'clase_suelta' || descUpper.includes('REPOSIÇÃO') || descUpper.includes('REPOSICAO') || descUpper.includes('EXPERIMENTAL') || descUpper.includes('CORTESIA') || descUpper.includes('TESTE');
      if (isFree) { juneUnpaidEstimatedValues[b.booking_id] = 0.0; return; }

      const dateObj = new Date(b.booking_date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const startTime = b.start_time || '00:00';
      const pricingInfo = getBasePriceForBooking(b);
      const slotKey = `${dayOfWeek}_${startTime}_${pricingInfo.category}`;
      if (!slots[slotKey]) slots[slotKey] = { dayOfWeek, startTime, pricingInfo, bookings: [] };
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
      const isOffPeak = slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5 && (parseInt(slot.startTime.split(':')[0], 10) >= 10 && parseInt(slot.startTime.split(':')[0], 10) <= 15);
      
      let slotProRataValue = pricing.isMonthly ? (nBookings / getWeekdayOccurrencesInMonth(parseInt(projBaseMonthPrefix.substring(0,4),10), parseInt(projBaseMonthPrefix.substring(5,7),10), slot.dayOfWeek)) * pricing.price : nBookings * pricing.price;
      let slotFinalValue = isOffPeak ? slotProRataValue * 0.88 : slotProRataValue * (1 - freqDiscountRate);
      const perBookingValue = slotFinalValue / nBookings;
      slot.bookings.forEach(b => { juneUnpaidEstimatedValues[b.booking_id] = perBookingValue; });
    });
  });

  const slotGroups = {};
  monthlyJuneBookings.forEach(b => {
    const studentName = b.participant_name || 'Desconhecido';
    const dateObj = new Date(b.booking_date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const startTime = b.start_time || '00:00';
    const slotKey = `${studentName}_${dayOfWeek}_${startTime}`;
    let val = b.is_paid ? (parseFloat(b.booking_value) || 0.0) : (juneUnpaidEstimatedValues[b.booking_id] || 0.0);
    
    if (!slotGroups[slotKey]) slotGroups[slotKey] = { studentName, customerCode: b.customer_code, dayOfWeek, startTime, values: [], booking: b };
    if (val > 0) slotGroups[slotKey].values.push(val);
  });

  const activeJuneSlots = [];
  Object.values(slotGroups).forEach(g => {
    const avgVal = g.values.length > 0 ? g.values.reduce((s, v) => s + v, 0) / g.values.length : 0.0;
    if (avgVal > 0) {
      const pricingInfo = getBasePriceForBooking(g.booking);
      const isOffPeak = g.dayOfWeek >= 1 && g.dayOfWeek <= 5 && (parseInt(g.startTime.split(':')[0], 10) >= 10 && parseInt(g.startTime.split(':')[0], 10) <= 15);
      const desc = (g.booking.description || '').toUpperCase();
      let discountRate = 0;
      if (desc.includes('SÓCIO') || desc.includes('SOCIO') || g.booking.is_socio_benefit) discountRate = 0.50;
      else if (desc.includes('HORA LIGHT') || isOffPeak) discountRate = 0.12;
      else if (desc.includes('DESCONTO FREQUENCIA +3') || desc.includes('FREQUENCIA +3')) discountRate = 0.07;
      else if (desc.includes('DESCONTO FREQUENCIA +2') || desc.includes('FREQUENCIA +2') || desc.includes('FAMÍLIA') || desc.includes('FAMILIA')) discountRate = 0.05;
      
      activeJuneSlots.push({
        studentName: g.studentName, customerCode: g.customerCode, dayOfWeek: g.dayOfWeek, startTime: g.startTime,
        unitPrice: avgVal, monthlyPrice: pricingInfo.price * (1 - discountRate)
      });
    }
  });

  // Calculate base inflows identically
  // Exact Month 1 calculations
  let baseTuitionVal = 0.0;
  activeJuneSlots.forEach(slot => { baseTuitionVal += slot.monthlyPrice; });

  const juneSalesTotal = allSalesData.filter(s => s.pay_date && s.pay_date.startsWith(projBaseMonthPrefix))
                                     .reduce((sum, s) => sum + (parseFloat(s.valor_faturamento) || 0.0), 0.0);
  const junePaidTuition = monthlyJuneBookings.filter(b => b.is_paid)
                                             .reduce((sum, b) => sum + (parseFloat(b.booking_value) || 0.0), 0.0);
  const juneVariableRevenueBaseline = Math.max(0.0, juneSalesTotal - junePaidTuition);

  const juneD30TuitionTotal = monthlyJuneBookings.map(b => {
    const val = b.is_paid ? (parseFloat(b.booking_value) || 0.0) : ((juneUnpaidEstimatedValues[b.booking_id] || 0.0) * UNPAID_RECOVERY_RATE);
    return val * baseD30Ratio;
  }).reduce((sum, val) => sum + val, 0.0);

  const monthIndex = 1; // July is monthIndex 1
  const tuitionGenerated = round2(baseTuitionVal * Math.pow(1 + growthRate, monthIndex));
  const tuitionReceivedD0 = round2(tuitionGenerated * baseD0Ratio);
  const tuitionReceivedD30 = juneD30TuitionTotal;

  let baseRentalHours = 0;
  let baseMaintHours = 0;
  let baseFixedHours = 0;
  let baseAvulsaHours = 0;
  if (prevCourtOccupancy.length > 0) {
    prevCourtOccupancy.forEach(item => {
      const tipo = (item.tipo_operacional || '').toLowerCase();
      const hours = parseFloat(item.horas_ocupadas) || 0;
      if (tipo.includes('manutenção') || tipo.includes('bloqueio') || tipo.includes('manutencao')) baseMaintHours += hours;
      else if (tipo.startsWith('aulas - regular') || tipo.includes('reserva mensal') || tipo.startsWith('aulas - adulto') || tipo.startsWith('aulas - kids') || tipo === 'outros') baseFixedHours += hours;
      else if (tipo.includes('locação - quadra avulsa')) baseRentalHours += hours;
      else if (tipo.includes('aulas - avulsa particular')) baseAvulsaHours += hours;
    });
  } else {
    baseMaintHours = 447.0; baseFixedHours = 242.0; baseAvulsaHours = 31.0; baseRentalHours = 140.50;
  }
  const courtNames = new Set(prevCourtOccupancy.map(d => d.resource_name).filter(Boolean));
  const numCourts = Math.max(courtNames.size, 4);
  const baseCapacityHours = calcTotalAvailableHoursForMonth(parseInt(projBaseMonthPrefix.substring(0,4), 10), parseInt(projBaseMonthPrefix.substring(5,7), 10)) * numCourts;
  const baseFreeHours = Math.max(0, baseCapacityHours - baseMaintHours - baseFixedHours - baseAvulsaHours);
  const baseRentalOccupancyRate = baseFreeHours > 0 ? (baseRentalHours / baseFreeHours) : 0.1641;
  const rentalEff = (prevHourlyEfficiency || []).find(d => (d.tipo_operacional || '').toLowerCase().includes('locação - quadra avulsa'));
  const ticketMedioLocacao = rentalEff ? parseFloat(rentalEff.faturamento_por_hora_ocupada) : 111.28;
  const baseRentalRevenue = baseRentalHours * ticketMedioLocacao;
  const baseOtherVarRevenue = Math.max(0.0, juneVariableRevenueBaseline - baseRentalRevenue);

  const projCapacityHours = calcTotalAvailableHoursForMonth(parseInt(year, 10), parseInt(month, 10)) * numCourts;
  const projFixedHours = baseFixedHours * Math.pow(1 + growthRate, monthIndex);
  const projFreeHours = Math.max(0, projCapacityHours - baseMaintHours - projFixedHours - baseAvulsaHours);
  const projOccupancyRate = Math.min(0.35, baseRentalOccupancyRate * Math.pow(1 + 0.05, monthIndex));
  const projRentalRevenue = (projFreeHours * projOccupancyRate) * ticketMedioLocacao;
  const projOtherVarRevenue = baseOtherVarRevenue * Math.pow(1 + growthRate, monthIndex);
  const projectedVarRevenue = round2(projRentalRevenue + projOtherVarRevenue);
  const variableReceivedD0 = round2(projectedVarRevenue * baseD0Ratio);
  const variableReceivedD30 = juneVariableRevenueBaseline * baseD30Ratio;
  
  // Já recebido no mês = receitas Procfy pagas no mês atual
  // Mesma fonte do DFC mensal (allProcfyData paid revenues)
  // Captura apenas o que fisicamente entrou no banco — exclui
  // pagamentos via cartão de crédito que ainda não liquidaram (D30)
  const alreadyReceived = round2(
    allProcfyData
      .filter(tx =>
        tx.paid &&
        tx.due_date &&
        tx.due_date.startsWith(baseMonthPrefix) &&
        tx.transaction_type === 'revenue'
      )
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0)
  );

  let totalInflow = round2(tuitionReceivedD0 + tuitionReceivedD30 + variableReceivedD0 + variableReceivedD30);
  let remainingD0ToReceive = tuitionReceivedD0 + variableReceivedD0;

  // Ajuste do totalInflow e D-0 se houver agenda importada para conciliar com as entradas reais e futuras
  const importedForMonth = (allImportedReceivablesData || []).filter(r => r.data_liberacao && r.data_liberacao.startsWith(mKey));
  
  let totalImportedForRemainingDays = 0.0;
  if (importedForMonth.length > 0) {
    // Pegar apenas os recebíveis da agenda futura (do dia de hoje em diante)
    totalImportedForRemainingDays = importedForMonth
      .filter(r => {
        const dNum = parseInt(r.data_liberacao.split('-')[2], 10);
        return dNum >= startDay;
      })
      .reduce((sum, r) => sum + (parseFloat(r.valor) || 0.0), 0.0);

    if (isCurrentRealMonth) {
      // Faturamento real acumulado no mês (Competência)
      const actualRevenueAcum = allSalesData
        .filter(s => s.pay_date && s.pay_date.startsWith(baseMonthPrefix))
        .reduce((sum, s) => sum + (parseFloat(s.valor_faturamento) || 0.0), 0.0);

      const totalProjectedRevenue = tuitionGenerated + projectedVarRevenue;
      const residualRevenue = Math.max(0, totalProjectedRevenue - actualRevenueAcum);
      remainingD0ToReceive = residualRevenue * baseD0Ratio;
    }
    
    const remainingToReceiveOverride = round2(totalImportedForRemainingDays + remainingD0ToReceive);
    totalInflow = round2(alreadyReceived + remainingToReceiveOverride);
  }

  const fixedMonthTotal = totalInflow;
  const remainingToReceive = round2(Math.max(0, fixedMonthTotal - alreadyReceived));

  // Exact Outflows matching Monthly DFC
  let totalProjCommission = 0.0;
  
  if (isCurrentRealMonth) {
    // 1. Comissão real já gerada por aulas pagas
    let actualPaidCommission = 0.0;
    allCommData.forEach(row => {
      const isPaidInMonth = row.is_paid && row.pay_date && row.pay_date.startsWith(baseMonthPrefix);
      if (isPaidInMonth) {
        const val = parseFloat(row.booking_value) || 0;
        const rawBase = parseFloat(row.booking_commission_base) || val;
        const commBase = getAdjustedCommissionBase(row, rawBase);
        actualPaidCommission += commBase * (getRateForTeacher(row.professor) / 100);
      }
    });

    // Somar comissões de vouchers já pagos
    (allVouchersData || []).forEach(v => {
      const prof = parseVoucherProfessor(v.description || '');
      if (!prof) return;
      const val = parseFloat(v.total) || 0.0;
      if (val <= 0 || /anula/i.test(v.description || '')) return;
      
      const payDateStr = v.pay_date ? v.pay_date.substring(0, 7) : '';
      if (payDateStr === baseMonthPrefix) {
        const rate = getRateForTeacher(prof);
        actualPaidCommission += val * (rate / 100);
      }
    });

    // 2. Comissão projetada das pendências reais (exclui meses futuros)
    let pendingCommissionBase = 0.0;
    allCommData.forEach(row => {
      const isPendingInMonth = !row.is_paid && row.booking_date && row.booking_date.startsWith(baseMonthPrefix);
      if (isPendingInMonth) {
        const desc = row.description || '';
        const isFutureMonthPlan = !row.booking_id && (
          desc.includes('agosto') || 
          desc.includes('setembro') || 
          desc.includes('outubro') || 
          desc.includes('novembro') || 
          desc.includes('dezembro') ||
          desc.includes('janeiro') ||
          desc.includes('fevereiro') ||
          desc.includes('março') ||
          desc.includes('marco') ||
          desc.includes('abril') ||
          desc.includes('maio') ||
          desc.includes('junho')
        );
        if (!isFutureMonthPlan) {
          const val = parseFloat(row.booking_value) || 0;
          const rawBase = parseFloat(row.booking_commission_base) || val;
          const commBase = getAdjustedCommissionBase(row, rawBase);
          pendingCommissionBase += commBase * (getRateForTeacher(row.professor) / 100);
        }
      }
    });

    const UNPAID_RECOVERY_RATE = 0.90;
    totalProjCommission = round2(actualPaidCommission + (pendingCommissionBase * UNPAID_RECOVERY_RATE));
  } else {
    // Para outros meses, utiliza o cálculo teórico do teto
    totalProjCommission = round2(tuitionGenerated * commissionRate);
  }

  // Divisão 70% no dia 20 e 30% no dia 30
  let remainingCommP1 = round2(totalProjCommission * 0.70);
  let remainingCommP2 = round2(totalProjCommission * 0.30);

  // Deduct already paid commissions in Procfy for the current month to avoid double counting.
  // If payments exist, P1 is assumed complete (any unpaid residual is pushed to P2 on day 30).
  if (isCurrentRealMonth) {
    const alreadyPaidCommissionProcfy = allProcfyData
      .filter(tx => 
        tx.paid &&
        tx.due_date && tx.due_date.startsWith(baseMonthPrefix) &&
        tx.transaction_type !== 'revenue' &&
        (tx.category_name && (tx.category_name.toLowerCase().includes('comissão') || tx.category_name.toLowerCase().includes('comissao')))
      )
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

    if (alreadyPaidCommissionProcfy > 0) {
      const originalP1 = remainingCommP1;
      const p1Residual = Math.max(0.0, round2(originalP1 - alreadyPaidCommissionProcfy));
      const overshoot = Math.max(0.0, round2(alreadyPaidCommissionProcfy - originalP1));
      
      remainingCommP1 = 0.0;
      remainingCommP2 = Math.max(0.0, round2((remainingCommP2 + p1Residual) - overshoot));
    }
  }

  let tuitionFees = 0.0;
  tuitionFees += tuitionReceivedD30 * 0.025; 
  activeJuneSlots.forEach(slot => {
    const slotVal = round2(slot.monthlyPrice * (1 + growthRate));
    const payments = allPaymentMethodsData.filter(p => p.customer_code === slot.customerCode);
    const isDebit = payments.some(p => (p.pay_method || '').toLowerCase() === 'cartão débito');
    if (isDebit) tuitionFees += (slotVal * baseD0Ratio) * 0.0099;
  });
  const totalFees = round2(tuitionFees + (variableReceivedD30 * 0.025));
  const dayFees = round2(totalFees / daysInMonth);

  // Calculate overdue precisely as Monthly DFC
  let juneRemainingUnpaidOutflowsOps = 0.0;
  let juneRemainingUnpaidOutflowsInv = 0.0;
  const todayDateFor3M = new Date();
  const isCurrentRealMonth3M = (projBaseMonthPrefix.substring(0,4) === String(todayDateFor3M.getFullYear()) && projBaseMonthPrefix.substring(5,7) === String(todayDateFor3M.getMonth() + 1).padStart(2, '0'));
  let startDay3M = 1;
  if (isCurrentRealMonth3M) startDay3M = todayDateFor3M.getDate();
  else if (projBaseMonthPrefix < `${todayDateFor3M.getFullYear()}-${String(todayDateFor3M.getMonth() + 1).padStart(2, '0')}`) {
    startDay3M = new Date(parseInt(projBaseMonthPrefix.substring(0,4), 10), parseInt(projBaseMonthPrefix.substring(5,7), 10), 0).getDate() + 1;
  }
  const todayStrFor3M = `${projBaseMonthPrefix.substring(0,4)}-${projBaseMonthPrefix.substring(5,7)}-${String(startDay3M).padStart(2, '0')}`;
  
  allProcfyData.forEach(tx => {
    if (!tx.due_date || tx.paid) return;
    if (tx.transaction_type !== 'revenue' && tx.due_date < todayStrFor3M) {
      if (tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos') juneRemainingUnpaidOutflowsInv += (parseFloat(tx.amount) || 0.0);
      else juneRemainingUnpaidOutflowsOps += (parseFloat(tx.amount) || 0.0);
    }
  });

  const procfyScheduledTxList = allProcfyData.filter(tx => tx.due_date && tx.due_date.startsWith(mKey) && !tx.paid && tx.transaction_type !== 'revenue');
  const procfyScheduledOps = procfyScheduledTxList.filter(tx => tx.cost_center_name !== 'Investimentos' && tx.cost_center_descricao !== 'Investimentos').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);
  const upcomingScheduledInv = procfyScheduledTxList.filter(tx => tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);
  
  const overdueOpsTotal = juneRemainingUnpaidOutflowsOps + allProcfyData.filter(tx => 
    !tx.paid && tx.transaction_type !== 'revenue' && tx.due_date && 
    tx.due_date >= `${year}-${month}-01` && tx.due_date < todayStr &&
    tx.cost_center_name !== 'Investimentos' && tx.cost_center_descricao !== 'Investimentos'
  ).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

  const overdueInvTotal = juneRemainingUnpaidOutflowsInv + allProcfyData.filter(tx => 
    !tx.paid && tx.transaction_type !== 'revenue' && tx.due_date && 
    tx.due_date >= `${year}-${month}-01` && tx.due_date < todayStr &&
    (tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos')
  ).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0.0), 0.0);

  const scheduledOpsTotalForMonth = round2(procfyScheduledOps + juneRemainingUnpaidOutflowsOps);

  const juneFixedExpensesBaseline = (dreData[projBaseMonthPrefix] ? dreData[projBaseMonthPrefix].energia : 0.0) + (dreData[projBaseMonthPrefix] ? dreData[projBaseMonthPrefix].despesasOperacionais : 0.0);
  const baseProvision = Math.max(0.0, juneFixedExpensesBaseline - scheduledOpsTotalForMonth);
  const elSafety = document.getElementById('proj-input-safety');
  const safetyRate = elSafety ? parseFloat(elSafety.value) / 100 : 0.05;
  const safetyProvision = (scheduledOpsTotalForMonth + baseProvision) * safetyRate;
  const totalFixedProvision = round2(baseProvision + safetyProvision);
  const dayProvision = round2(totalFixedProvision / daysInMonth);

  const overdueInflowTotal = 0.0; // Inflows are perfectly matched by the totalInflow calculation!

  // ── BANK BALANCE & RUNNING BALANCE ───────────────────────────────
  let currentActualCashBalance = 17430.92; // Default fallback
  if (allProcfyData && allProcfyData.length > 0) {
    const sortedBySync = [...allProcfyData].sort((a, b) => {
      const dateA = a.synced_at || '';
      const dateB = b.synced_at || '';
      return dateB.localeCompare(dateA);
    });
    if (sortedBySync[0] && sortedBySync[0].bank_account_balance_cents !== undefined) {
      currentActualCashBalance = sortedBySync[0].bank_account_balance_cents / 100;
    }
  }
  
  // Consolidate with investment account balance if we are in July 2026 or later
  if (baseMonthPrefix >= '2026-07') {
    currentActualCashBalance += calculateInvestmentBalance(allInterData);
  }

  const selMonthInitial = (monthlyData[baseMonthPrefix] && monthlyData[baseMonthPrefix].initial) || 7280.98;
  let runningBalance = selMonthInitial;

  if (isCurrentRealMonth) {
    runningBalance = currentActualCashBalance;
  } else {
    allProcfyData.forEach(tx => {
      if (!tx.paid) return;
      if (!tx.due_date || !tx.due_date.startsWith(baseMonthPrefix)) return;
      if (tx.due_date >= todayStr) return;
      
      // Skip internal transfers for July 2026 and later to avoid double counting
      if (tx.transaction_type === 'transfer' && baseMonthPrefix >= '2026-07') return;

      const amount = parseFloat(tx.amount) || 0.0;
      if (tx.transaction_type === 'revenue') { runningBalance += amount; }
      else { runningBalance -= amount; }
    });
    allInterData.forEach(tx => {
      const desc = (tx.descricao || '').toLowerCase();
      const title = (tx.titulo || '').toLowerCase();
      
      if (baseMonthPrefix < '2026-07') {
        const isResgate = desc.includes('resgate') || desc.includes('cdb') || title.includes('resgate');
        if (isResgate && tx.data_movimento && tx.data_movimento.startsWith(baseMonthPrefix) && tx.data_movimento < todayStr) {
          runningBalance += Math.abs(parseFloat(tx.valor_com_sinal)) || 0;
        }
      }
    });
  }

  // Re-add lists for the UI tables at the bottom
  const overdueProcfyList = allProcfyData.filter(tx =>
    !tx.paid && tx.transaction_type !== 'revenue' && tx.due_date && tx.due_date < todayStr
  );
  const upcomingProcfyList = allProcfyData.filter(tx =>
    !tx.paid && tx.transaction_type !== 'revenue' && tx.due_date &&
    tx.due_date >= todayStr && tx.due_date.startsWith(mKey)
  );

  // Use hardcoded day-of-week weights (Sunday is usually slower)
  const dowWeights = [0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

  // Calcular peso total do mês e peso apenas dos dias restantes (startDay em diante)
  let totalMonthWeight = 0;
  let remainingDaysWeight = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(dayStr + 'T00:00:00');
    const dow = dateObj.getDay();
    totalMonthWeight += dowWeights[dow];
    if (d >= startDay) remainingDaysWeight += dowWeights[dow];
  }
  // Fallback para evitar divisão por zero
  if (remainingDaysWeight <= 0) remainingDaysWeight = 1;

  // Loop day-by-day
  const dailyProjection = [];
  let sumProjectedInflows = 0.0;
  
  for (let d = startDay; d <= daysInMonth; d++) {
    const dayStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(dayStr + 'T00:00:00');
    const dow = dateObj.getDay();
    const dayWeight = dowWeights[dow];
    
    const chkIncludeInflows = document.getElementById('chk-include-inflows');
    const includeInflows = chkIncludeInflows ? chkIncludeInflows.checked : true;
    
    let totalInflowDay = 0.0;
    
    // Check if there is any imported receivables agenda for this month
    const importedForMonth = (allImportedReceivablesData || []).filter(r => r.data_liberacao && r.data_liberacao.startsWith(mKey));
    
    if (importedForMonth.length > 0) {
      // Use imported exact D-30 for this day + estimated proportional D-0 (Pix/Debit) for this day
      const importedForDay = importedForMonth.filter(r => r.data_liberacao === dayStr).reduce((sum, r) => sum + (parseFloat(r.valor) || 0.0), 0.0);
      const dayD0 = includeInflows ? round2(remainingD0ToReceive * (dayWeight / remainingDaysWeight)) : 0.0;
      totalInflowDay = round2(dayD0 + importedForDay);
    } else {
      // Fallback: distribute remaining to receive proportionally over remaining days
      totalInflowDay = includeInflows ? round2(remainingToReceive * (dayWeight / remainingDaysWeight)) : 0.0;
      
      // Custom override for July 2026 starting from July 21st (kept for historic compatibility)
      if (selectedYearInt === 2026 && selectedMonthInt === 7) {
        if (d >= 21) {
          const julInflows = {
            21: 1227.94,
            22: 343.22,
            23: 503.13,
            24: 621.77,
            25: 497.78,
            26: 1508.72,
            27: 3061.27,
            28: 999.42,
            29: 1874.29,
            30: 478.95,
            31: 8820.55
          };
          totalInflowDay = includeInflows ? (julInflows[d] || 0.0) : 0.0;
        }
      }
    }

    sumProjectedInflows += totalInflowDay;

    let outflowOps = round2(dayProvision + dayFees);
    let outflowInv = 0.0;

    allProcfyData.forEach(tx => {
      if (tx.paid) return;
      if (tx.transaction_type === 'revenue') return;
      if (tx.due_date && tx.due_date.startsWith(dayStr)) {
        const amt = parseFloat(tx.amount) || 0.0;
        if (tx.cost_center_name === 'Investimentos' || tx.cost_center_descricao === 'Investimentos') {
          outflowInv += amt;
        } else {
          outflowOps += amt;
        }
      }
    });

    if (d === startDay) {
      outflowOps += overdueOpsTotal;
      outflowInv += overdueInvTotal;
    }

    if (d === 20 && startDay <= 20) {
      outflowOps += remainingCommP1;
    }
    if (d === 30) {
      outflowOps += remainingCommP2;
      if (startDay > 20) {
        outflowOps += remainingCommP1;
      }
    }

    const dayInitialBalance = runningBalance;
    const netFlowOpsDay = round2(totalInflowDay - outflowOps);
    const netFlowDay = round2(netFlowOpsDay - outflowInv);
    const dayFinalBalance = round2(dayInitialBalance + netFlowDay);

    dailyProjection.push({
      day: d,
      dateLabel: `${String(d).padStart(2, '0')}/${month}`,
      initialBalance: dayInitialBalance,
      inflow: totalInflowDay,
      outflowOps: outflowOps,
      netFlowOps: netFlowOpsDay,
      outflowInv: outflowInv,
      netFlow: netFlowDay,
      finalBalance: dayFinalBalance
    });

    runningBalance = dayFinalBalance;
  }

  // Store the month-end balance so the 3-month projection can use it as July opening balance
  cachedMonthEndProjectionBalance = runningBalance;

  // Render Table
  let html = '';
  if (dailyProjection.length === 0) {
    html = `<tr><td colspan="8" class="empty-state">Sem projeção pendente para este mês. Todas as contas foram realizadas ou o mês selecionado está no passado.</td></tr>`;
  } else {
    html = dailyProjection.map(r => {
      const signedOutflowOps = r.outflowOps > 0 ? `-${formatCurrency(r.outflowOps)}` : formatCurrency(0);
      const signedOutflowInv = r.outflowInv > 0 ? `-${formatCurrency(r.outflowInv)}` : formatCurrency(0);
      
      const opsClass = r.outflowOps > 0 ? 'text-outflow' : '';
      const invClass = r.outflowInv > 0 ? 'text-outflow' : '';
      
      const netOpsClass = r.netFlowOps > 0 ? 'text-inflow' : (r.netFlowOps < 0 ? 'text-outflow' : '');
      const netClass = r.netFlow > 0 ? 'text-inflow' : (r.netFlow < 0 ? 'text-outflow' : '');
      
      const valInitial = formatCurrency(r.initialBalance);
      const valInflow = formatCurrency(r.inflow);
      const valNetOps = r.netFlowOps < 0 ? `-${formatCurrency(Math.abs(r.netFlowOps))}` : formatCurrency(r.netFlowOps);
      const valNet = r.netFlow < 0 ? `-${formatCurrency(Math.abs(r.netFlow))}` : formatCurrency(r.netFlow);
      const valFinal = formatCurrency(r.finalBalance);

      const rowClass = r.day === startDay && isCurrentRealMonth ? 'style="background: rgba(192, 81, 49, 0.08); font-weight: 600;"' : '';
      const todayBadge = r.day === startDay && isCurrentRealMonth ? ' <span class="period-badge" style="font-size: 0.55rem; padding: 1px 4px; vertical-align: middle; margin-left: 4px;">Hoje</span>' : '';

      return `
        <tr ${rowClass}>
          <td><strong>${r.dateLabel}</strong>${todayBadge}</td>
          <td class="text-right">${valInitial}</td>
          <td class="text-right text-inflow">${valInflow}</td>
          <td class="text-right ${opsClass}">${signedOutflowOps}</td>
          <td class="text-right ${netOpsClass}" style="font-weight: 600;">${valNetOps}</td>
          <td class="text-right ${invClass}">${signedOutflowInv}</td>
          <td class="text-right ${netClass}" style="font-weight: 600;">${valNet}</td>
          <td class="text-right" style="font-weight: 700;">${valFinal}</td>
        </tr>
      `;
    }).join('');
  }
  
  const tbody = document.getElementById('fin-proj-current-body');
  if (tbody) {
    tbody.innerHTML = html;
  }

  // ── BARRA DE RESUMO DO TETO FIXO ────────────────────────────────
  const summaryEl = document.getElementById('fin-proj-current-summary');
  if (summaryEl) {
    const monthsFullBR = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const monthLabel = `${monthsFullBR[parseInt(month, 10) - 1]}/${year}`;
    
    // Custom logic for July 2026 to show correct sum of custom inputs
    const dispFixedMonthTotal = (selectedYearInt === 2026 && selectedMonthInt === 7) ? (alreadyReceived + sumProjectedInflows) : fixedMonthTotal;
    const dispRemainingToReceive = (selectedYearInt === 2026 && selectedMonthInt === 7) ? sumProjectedInflows : remainingToReceive;
    
    const pctReceived = dispFixedMonthTotal > 0 ? Math.round((alreadyReceived / dispFixedMonthTotal) * 100) : 0;
    summaryEl.innerHTML = `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; padding:0.75rem 1rem;
                  background:rgba(255,255,255,0.04); border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
        <div style="flex:1; min-width:140px; text-align:center;">
          <div style="font-size:0.7rem; color:#aaa; text-transform:uppercase; letter-spacing:0.05em;">🏆 Teto Fixo — ${monthLabel}</div>
          <div style="font-size:1.1rem; font-weight:700; color:#e0e0e0; margin-top:2px;">${formatCurrency(dispFixedMonthTotal)}</div>
          <div style="font-size:0.65rem; color:#888; margin-top:1px;">D0 ${monthLabel} + D30 mês anterior</div>
        </div>
        <div style="flex:1; min-width:140px; text-align:center;">
          <div style="font-size:0.7rem; color:#aaa; text-transform:uppercase; letter-spacing:0.05em;">✅ Já Recebido</div>
          <div style="font-size:1.1rem; font-weight:700; color:#4caf82; margin-top:2px;">${formatCurrency(alreadyReceived)}</div>
          <div style="font-size:0.65rem; color:#888; margin-top:1px;">${pctReceived}% do teto · DFC realizado</div>
        </div>
        <div style="flex:1; min-width:140px; text-align:center;">
          <div style="font-size:0.7rem; color:#aaa; text-transform:uppercase; letter-spacing:0.05em;">📤 A Receber</div>
          <div style="font-size:1.1rem; font-weight:700; color:#c0b86a; margin-top:2px;">${formatCurrency(dispRemainingToReceive)}</div>
          <div style="font-size:0.65rem; color:#888; margin-top:1px;">Projetado nos dias restantes</div>
        </div>
      </div>
    `;
  }

  // Render Overdue details
  const overdueTbody = document.getElementById('fin-proj-current-overdue-rows');
  if (overdueTbody) {
    let overdueHtml = '';
    let overdueCommissions = 0.0;
    let commDueDate = `${daysInMonth}/${month}/${year}`;
    let commLabel = 'Comissões de Professores (Total Pendente)';
    
    if (isCurrentRealMonth) {
      if (startDay > 30) {
        overdueCommissions = remainingCommP1 + remainingCommP2;
      } else if (startDay > 20) {
        overdueCommissions = remainingCommP1;
        commDueDate = `20/${month}/${year}`;
        commLabel = 'Comissões de Professores (1º Período Pendente)';
      }
    }
    
    if (overdueProcfyList.length === 0 && overdueCommissions === 0) {
      overdueHtml = `<tr><td colspan="4" class="empty-state">Nenhuma conta vencida.</td></tr>`;
    } else {
      overdueHtml += overdueProcfyList.map(tx => {
        const flow = tx.cost_center_descricao || tx.cost_center_name || 'Operação';
        return `
          <tr>
            <td>${formatDateBR(tx.due_date)}</td>
            <td>${tx.name || 'Despesa'}</td>
            <td>${flow}</td>
            <td class="text-right text-outflow">-${formatCurrency(parseFloat(tx.amount) || 0.0)}</td>
          </tr>
        `;
      }).join('');
      
      if (overdueCommissions > 0) {
        overdueHtml += `
          <tr>
            <td>${commDueDate}</td>
            <td>${commLabel}</td>
            <td>Operação</td>
            <td class="text-right text-outflow">-${formatCurrency(overdueCommissions)}</td>
          </tr>
        `;
      }
    }
    overdueTbody.innerHTML = overdueHtml;
  }

  // Render Upcoming details
  const upcomingTbody = document.getElementById('fin-proj-current-upcoming-rows');
  if (upcomingTbody) {
    let upcomingHtml = '';
    const hasCommP1 = (startDay <= 20) && remainingCommP1 > 0;
    const hasCommP2 = (remainingCommP2 + (startDay > 20 ? remainingCommP1 : 0.0)) > 0;
    
    let pendingCommissions = 0.0;
    if (!isCurrentRealMonth) {
      pendingCommissions = calculateGlobalPendingCommissionsForMonth(year, month);
    }
    
    if (upcomingProcfyList.length === 0 && !hasCommP1 && !hasCommP2 && pendingCommissions === 0) {
      upcomingHtml = `<tr><td colspan="4" class="empty-state">Nenhum lançamento agendado.</td></tr>`;
    } else {
      const sortedUpcoming = [...upcomingProcfyList].sort((a, b) => a.due_date.localeCompare(b.due_date));
      let commP1Added = false;
      let commP2Added = false;
      const rows = [];
      
      sortedUpcoming.forEach(tx => {
        const flow = tx.cost_center_descricao || tx.cost_center_name || 'Operação';
        const dateStr = tx.due_date;
        const day = parseInt(dateStr.substring(8, 10), 10);
        
        if (hasCommP1 && day >= 20 && !commP1Added) {
          rows.push({
            date: `${year}-${month}-20`,
            name: 'Comissões de Professores (1º Período)',
            flow: 'Operação',
            amount: remainingCommP1
          });
          commP1Added = true;
        }
        
        if (hasCommP2 && day >= 30 && !commP2Added) {
          rows.push({
            date: `${year}-${month}-30`,
            name: 'Comissões de Professores (2º Período)',
            flow: 'Operação',
            amount: remainingCommP2 + (startDay > 20 ? remainingCommP1 : 0.0)
          });
          commP2Added = true;
        }
        
        rows.push({
          date: tx.due_date,
          name: tx.name || 'Despesa',
          flow: flow,
          amount: parseFloat(tx.amount) || 0.0
        });
      });
      
      if (hasCommP1 && !commP1Added) {
        rows.push({
          date: `${year}-${month}-20`,
          name: 'Comissões de Professores (1º Período)',
          flow: 'Operação',
          amount: remainingCommP1
        });
      }
      if (hasCommP2 && !commP2Added) {
        rows.push({
          date: `${year}-${month}-30`,
          name: 'Comissões de Professores (2º Período)',
          flow: 'Operação',
          amount: remainingCommP2 + (startDay > 20 ? remainingCommP1 : 0.0)
        });
      }
      
      if (pendingCommissions > 0) {
        let nextM = parseInt(month, 10) + 1;
        let nextY = parseInt(year, 10);
        if (nextM > 12) { nextM = 1; nextY++; }
        rows.push({
          date: `${nextY}-${String(nextM).padStart(2, '0')}-05`,
          name: 'Comissões a Repassar (Mês Anterior)',
          flow: 'Operação',
          amount: pendingCommissions
        });
      }
      
      rows.sort((a, b) => a.date.localeCompare(b.date));
      
      upcomingHtml = rows.map(r => `
        <tr>
          <td>${formatDateBR(r.date)}</td>
          <td>${r.name}</td>
          <td>${r.flow}</td>
          <td class="text-right text-outflow">-${formatCurrency(r.amount)}</td>
        </tr>
      `).join('');
    }
    upcomingTbody.innerHTML = upcomingHtml;
  }
  } catch (err) {
    console.error("Erro na projeção diária:", err);
    const tbody = document.getElementById('fin-proj-current-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color: #e63946; font-weight: 600; padding: 20px;">⚠️ Erro ao calcular projeção diária: ${err.message}<br><pre style="text-align: left; font-size: 0.75rem; margin-top: 10px; white-space: pre-wrap; overflow-x: auto;">${err.stack}</pre></td></tr>`;
    }
  }
}

// ---- Print Layout Customizations (Only for PDF Export) ----
let originalPrintState = null;

// Helper to parse currency string (like R$ 2.406,53)
function parseCurrency(str) {
  if (!str) return 0;
  const cleaned = str.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

window.addEventListener('beforeprint', () => {
  const printCommRate = document.getElementById('print-commission-rate');
  const lblPrintTotalPago = document.getElementById('lbl-print-total-pago');
  const printValTotalPago = document.getElementById('print-val-total-pago');
  const printValComissao = document.getElementById('print-val-comissao');
  
  const commHeader = document.querySelector('#students-table th:nth-child(4)');
  const valHeader = document.querySelector('#students-table th:nth-child(3)');
  
  // Save original state to restore on afterprint
  originalPrintState = {
    printCommRateText: printCommRate ? printCommRate.innerText : '',
    lblPrintTotalPagoText: lblPrintTotalPago ? lblPrintTotalPago.innerText : '',
    printValTotalPagoText: printValTotalPago ? printValTotalPago.innerText : '',
    commHeaderHTML: commHeader ? commHeader.innerHTML : '',
    valHeaderHTML: valHeader ? valHeader.innerHTML : '',
    rows: []
  };
  
  // 1. Update print metadata to show 50%
  if (printCommRate) printCommRate.innerText = '50%';
  
  // 2. Update print summary faturamento description and value (Comissao * 2)
  if (lblPrintTotalPago) {
    const isPaid = (typeof currentTab !== 'undefined' ? currentTab : 'paid') === 'paid';
    lblPrintTotalPago.innerText = isPaid ? 'Valor Faturado Líquido (Total Pago)' : 'Valor Previsto Líquido (Estimativa)';
  }
  
  if (printValTotalPago && printValComissao) {
    const comissaoVal = parseCurrency(printValComissao.innerText);
    printValTotalPago.innerText = formatCurrency(comissaoVal * 2);
  }
  
  // 3. Update table headers to 50% and Líquido
  if (commHeader) {
    const isPaid = (typeof currentTab !== 'undefined' ? currentTab : 'paid') === 'paid';
    commHeader.innerHTML = isPaid ? 'Comissão (50%)' : 'Comissão Prevista (50%)';
  }
  
  if (valHeader) {
    const isPaid = (typeof currentTab !== 'undefined' ? currentTab : 'paid') === 'paid';
    valHeader.innerText = isPaid ? 'Valor Pago Líquido (Rateado)' : 'Valor Estimado Líquido (Rateado)';
  }
  
  // 4. Update table rows (faturamento = comissao * 2)
  const rows = document.querySelectorAll('#students-table-rows tr');
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      const faturamentoCell = cells[2];
      const comissaoCell = cells[3];
      
      originalPrintState.rows.push({
        index: index,
        faturamentoHTML: faturamentoCell.innerHTML
      });
      
      const comissaoVal = parseCurrency(comissaoCell.innerText);
      faturamentoCell.innerText = formatCurrency(comissaoVal * 2);
    }
  });
});

window.addEventListener('afterprint', () => {
  if (!originalPrintState) return;
  
  const printCommRate = document.getElementById('print-commission-rate');
  const lblPrintTotalPago = document.getElementById('lbl-print-total-pago');
  const printValTotalPago = document.getElementById('print-val-total-pago');
  
  const commHeader = document.querySelector('#students-table th:nth-child(4)');
  const valHeader = document.querySelector('#students-table th:nth-child(3)');
  
  if (printCommRate) printCommRate.innerText = originalPrintState.printCommRateText;
  if (lblPrintTotalPago) lblPrintTotalPago.innerText = originalPrintState.lblPrintTotalPagoText;
  if (printValTotalPago) printValTotalPago.innerText = originalPrintState.printValTotalPagoText;
  
  if (commHeader) commHeader.innerHTML = originalPrintState.commHeaderHTML;
  if (valHeader) valHeader.innerHTML = originalPrintState.valHeaderHTML;
  
  const rows = document.querySelectorAll('#students-table-rows tr');
  originalPrintState.rows.forEach(r => {
    const row = rows[r.index];
    if (row) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        cells[2].innerHTML = r.faturamentoHTML;
      }
    }
  });
  
  originalPrintState = null;
});

// ---- Render Goals Dashboard (Acompanhamento de Metas) ----
function renderGoalsDashboard(itemsData, courtData, totalHoursOcupadas, year, month, totalActiveStudents) {
  const targetStudents = 300;
  const targetSnack = 10000;
  const targetOccupancy = 50;

  // Goals before August 2026: Rentals 15000, Ticket 550
  // Goals for August 2026 and forward: Rentals 25000, Ticket 600
  const y = parseInt(year, 10) || 2026;
  const m = parseInt(month, 10) || 7;
  
  let targetRentals = 15000;
  let targetTicket = 550;
  
  if (y > 2026 || (y === 2026 && m >= 8)) {
    targetRentals = 25000;
    targetTicket = 600;
  }

  // 1. Group and calculate values from itemsData
  const studentsSet = new Set();
  let locacaoRevenue = 0;
  let aulasRevenue = 0;
  let totalRevenue = 0;

  itemsData.forEach(item => {
    const desc = (item.item_description || '').toLowerCase();
    const cat = (item.categoria || '').toLowerCase();
    const prod = (item.produto_padronizado || '').toLowerCase();
    const val = parseFloat(item.valor_faturamento) || 0;
    
    const isLesson = cat === 'aulas' || desc.includes('tênis') || desc.includes('aula') || desc.includes('kids') || desc.includes('baby') || prod.includes('tênis') || prod.includes('aula');
    const isRental = cat === 'locação' || desc.includes('locação') || desc.includes('reserva') || prod.includes('locação') || prod.includes('reserva');

    if (isLesson) {
      aulasRevenue += val;
      if (item.customer_code) {
        studentsSet.add(item.customer_code);
      }
    } else if (isRental) {
      locacaoRevenue += val;
    }
    
    totalRevenue += val;
  });

  const activeStudentsCount = studentsSet.size;
  const lanchoneteRevenue = totalRevenue - (aulasRevenue + locacaoRevenue);
  const ticketMedioAulas = activeStudentsCount > 0 ? (aulasRevenue / activeStudentsCount) : 0;

  // 2. Calculate Occupancy Geral
  const numCourts = Math.max(new Set(courtData.map(d => d.resource_name).filter(Boolean)).size, 4);
  const totalAvailHours = calcTotalAvailableHoursForMonth(parseInt(year, 10), parseInt(month, 10)) * numCourts;
  const occupancyRate = totalAvailHours > 0 ? (totalHoursOcupadas / totalAvailHours) * 100 : 0;

  // Helper for rendering cards
  function updateGoalCard(cardId, currentVal, targetVal, formatFn, isAchieved) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const valCurrentEl = card.querySelector('.goal-current');
    const badgeEl = card.querySelector('.goal-badge');
    const fillEl = card.querySelector('.goal-progress-bar-fill');
    const pctEl = card.querySelector('.goal-pct');
    const footerEl = card.querySelector('.goal-footer-text');
    const targetEl = card.querySelector('.goal-target');

    if (valCurrentEl) valCurrentEl.innerText = formatFn(currentVal);

    if (targetEl) {
      if (cardId === 'goal-card-students') {
        targetEl.innerText = `Meta: ${targetVal} alunos`;
      } else if (cardId === 'goal-card-occupancy') {
        targetEl.innerText = `Meta: ${targetVal.toFixed(1).replace('.', ',')}%`;
      } else {
        targetEl.innerText = `Meta: ${formatFn(targetVal)}`;
      }
    }

    const pct = targetVal > 0 ? (currentVal / targetVal) * 100 : 0;
    if (pctEl) pctEl.innerText = pct.toFixed(1).replace('.', ',') + '%';

    if (fillEl) fillEl.style.width = Math.min(pct, 100) + '%';

    if (isAchieved) {
      card.classList.add('achieved');
      if (badgeEl) {
        badgeEl.innerText = 'Atingido!';
        badgeEl.className = 'goal-badge success';
      }
    } else {
      card.classList.remove('achieved');
      if (badgeEl) {
        badgeEl.innerText = 'Pendente';
        badgeEl.className = 'goal-badge pending';
      }
    }

    if (footerEl) {
      if (isAchieved) {
        const exceeded = currentVal - targetVal;
        if (exceeded > 0.01) {
          footerEl.innerHTML = `Meta superada por <strong style="color:#2ec4b6;">${formatFn(exceeded)}</strong>`;
        } else {
          footerEl.innerHTML = `<strong style="color:#2ec4b6;">Meta alcançada!</strong>`;
        }
      } else {
        const remaining = targetVal - currentVal;
        footerEl.innerHTML = `Faltam <strong>${formatFn(remaining)}</strong> para a meta`;
      }
    }
  }

  // 3. Update all 5 cards
  updateGoalCard(
    'goal-card-students',
    totalActiveStudents,
    targetStudents,
    v => Math.round(v) + (v === 1 ? ' aluno' : ' alunos'),
    totalActiveStudents >= targetStudents
  );

  updateGoalCard(
    'goal-card-rentals',
    locacaoRevenue,
    targetRentals,
    formatCurrency,
    locacaoRevenue >= targetRentals
  );

  updateGoalCard(
    'goal-card-snack',
    lanchoneteRevenue,
    targetSnack,
    formatCurrency,
    lanchoneteRevenue >= targetSnack
  );

  updateGoalCard(
    'goal-card-ticket',
    ticketMedioAulas,
    targetTicket,
    formatCurrency,
    ticketMedioAulas >= targetTicket
  );

  updateGoalCard(
    'goal-card-occupancy',
    occupancyRate,
    targetOccupancy,
    v => v.toFixed(1).replace('.', ',') + '%',
    occupancyRate >= targetOccupancy
  );
}


// ---- Monthly Report Generation & Rendering Logic ----

async function loadMonthlyReport() {
  debugLog('loadMonthlyReport() disparado.');
  
  const reportCommissionsRows = document.getElementById('report-commissions-rows');
  if (reportCommissionsRows) {
    reportCommissionsRows.innerHTML = `<tr><td colspan="4" class="empty-state">Preparando relatório e carregando dados...</td></tr>`;
  }
  
  try {
    const year = selectYear.value;
    const month = selectMonth.value;
    const monthStart = `${year}-${month}-01`;
    const monthEnd = getEndOfMonth(monthStart);
    const nextMonthStart = (() => {
      const d = new Date(monthStart + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0].substring(0, 8) + '01';
    })();

    // Query for all paid classes and occurrence dates for commissions table in the report
    const classesParams = `select=*,pay_date&or=(and(booking_date.gte.${monthStart},booking_date.lte.${monthEnd}),and(pay_date.gte.${monthStart},pay_date.lt.${nextMonthStart}))`;
    debugLog('Buscando aulas para o relatório consolidado...');

    // 1. Load operational, financial, and commissions data for the current month in parallel
    const [classesData] = await Promise.all([
      supabaseSelect('vw_mt_comissoes_detalhadas', classesParams),
      loadOperationalReports(),
      loadFinancialReports()
    ]);
    
    // Store in global cache so renderReportCommissions can use it
    currentClassesData = classesData || [];
    
    // 2. Render teacher commissions summary (soma de comissões de todos os professores)
    renderReportCommissions();

    // 3. Copy tables and cards from screen elements
    // Metas/Goals
    const reportGoalsGrid = document.getElementById('report-goals-grid');
    const screenGoalsGrid = document.querySelector('#section-operational .goals-grid');
    if (reportGoalsGrid && screenGoalsGrid) {
      reportGoalsGrid.innerHTML = screenGoalsGrid.innerHTML;
    }
    
    // Efficiency Table
    const reportEfficiencyRows = document.getElementById('report-efficiency-rows');
    const screenEfficiencyRows = document.getElementById('op-table-efficiency-rows');
    if (reportEfficiencyRows && screenEfficiencyRows) {
      reportEfficiencyRows.innerHTML = screenEfficiencyRows.innerHTML;
    }
    
    // DFC
    const reportDfcHeaderRow = document.getElementById('report-dfc-header-row');
    const screenDfcHeaderRow = document.getElementById('fin-dfc-header-row');
    if (reportDfcHeaderRow && screenDfcHeaderRow) reportDfcHeaderRow.innerHTML = screenDfcHeaderRow.innerHTML;
    
    const reportDfcRows = document.getElementById('report-dfc-rows');
    const screenDfcRows = document.getElementById('fin-dfc-body');
    if (reportDfcRows && screenDfcRows) reportDfcRows.innerHTML = screenDfcRows.innerHTML;
    
    // DRE
    const reportDreHeaderRow = document.getElementById('report-dre-header-row');
    const screenDreHeaderRow = document.getElementById('fin-dre-header-row');
    if (reportDreHeaderRow && screenDreHeaderRow) reportDreHeaderRow.innerHTML = screenDreHeaderRow.innerHTML;
    
    const reportDreRows = document.getElementById('report-dre-rows');
    const screenDreRows = document.getElementById('fin-dre-body');
    if (reportDreRows && screenDreRows) reportDreRows.innerHTML = screenDreRows.innerHTML;
    
    // Projection 3-Months
    const reportProjHeader = document.getElementById('report-projection-header-row');
    const screenProjHeader = document.getElementById('fin-projection-header-row');
    if (reportProjHeader && screenProjHeader) reportProjHeader.innerHTML = screenProjHeader.innerHTML;
    
    const reportProjRows = document.getElementById('report-projection-rows');
    const screenProjRows = document.getElementById('fin-projection-body');
    if (reportProjRows && screenProjRows) reportProjRows.innerHTML = screenProjRows.innerHTML;
    
    // Projected Revenue Card
    const reportProjRevCard = document.getElementById('report-projected-revenue-card');
    const screenProjRevCard = document.getElementById('proj-billing-grid');
    if (reportProjRevCard && screenProjRevCard) {
      const firstCard = screenProjRevCard.querySelector('.billing-card');
      if (firstCard) {
        reportProjRevCard.innerHTML = `
          <h4 style="margin:0 0 1rem; color:#fff; font-size:0.9rem; font-weight:700;">Próximo Mês</h4>
          ${firstCard.outerHTML}
        `;
      } else {
        reportProjRevCard.innerHTML = screenProjRevCard.innerHTML;
      }
    }

    // 4. Update Header metadata for printing
    const formattedPeriod = getMonthNameBR(monthStart);
    
    const reportPrintPeriod = document.getElementById('report-print-period');
    if (reportPrintPeriod) reportPrintPeriod.innerText = formattedPeriod;
    
    const reportPrintGenDate = document.getElementById('report-print-generation-date');
    if (reportPrintGenDate) reportPrintGenDate.innerText = new Date().toLocaleDateString('pt-BR');

    // 5. Render report charts
    renderReportCharts();

    // 6. Make sure comments printed fields are synced with textareas
    syncCommentsToPrint();

  } catch (err) {
    debugError('Erro ao carregar o relatório mensal', err);
    if (reportCommissionsRows) {
      reportCommissionsRows.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:var(--color-saibro);">Erro ao carregar os dados do relatório: ${err.message}</td></tr>`;
    }
  }
}

function renderReportCommissions() {
  const reportCommissionsRows = document.getElementById('report-commissions-rows');
  if (!reportCommissionsRows) return;

  const year = selectYear.value;
  const month = selectMonth.value;
  const baseMonthPrefix = `${year}-${month}`;

  const teacherData = {}; // professor -> { classesCount, faturamento, commission }

  currentClassesData.forEach(row => {
    const isPaidInSelectedMonth = row.is_paid && row.pay_date && row.pay_date.startsWith(baseMonthPrefix);
    if (!isPaidInSelectedMonth) return;

    const prof = row.professor || 'Desconhecido';
    const val = parseFloat(row.booking_value) || 0;
    const rawBase = parseFloat(row.booking_commission_base) || val;
    const commBase = getAdjustedCommissionBase(row, rawBase);

    if (!teacherData[prof]) {
      teacherData[prof] = { classesCount: 0, faturamento: 0, commission: 0 };
    }

    const rate = getRateForTeacher(prof);
    teacherData[prof].classesCount += 1;
    teacherData[prof].faturamento += val;
    teacherData[prof].commission += commBase * (rate / 100);
  });

  // Include Intensivão vouchers in monthly report
  const vouchers = (cachedFinancialData && cachedFinancialData.allVouchersData) || currentVoucherData || [];
  const filteredVouchers = (vouchers || []).filter(v => {
    const prof = parseVoucherProfessor(v.description || '');
    return prof && parseFloat(v.total) > 0 && !/anula/i.test(v.description || '');
  });

  filteredVouchers.forEach(v => {
    const prof = parseVoucherProfessor(v.description || '');
    const val = parseFloat(v.total) || 0;
    const payDateStr = (v.pay_date || '').split('T')[0];
    const monthKey = payDateStr ? payDateStr.substring(0, 7) : '';
    if (monthKey !== baseMonthPrefix) return;

    if (!teacherData[prof]) {
      teacherData[prof] = { classesCount: 0, faturamento: 0, commission: 0 };
    }

    const rate = getRateForTeacher(prof);
    teacherData[prof].classesCount += 1;
    teacherData[prof].faturamento += val;
    teacherData[prof].commission += val * (rate / 100);
  });

  const teachers = Object.keys(teacherData).sort();

  if (teachers.length === 0) {
    reportCommissionsRows.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhuma comissão paga neste período.</td></tr>`;
    return;
  }

  let totalClasses = 0;
  let totalFat = 0;
  let totalComm = 0;

  let html = teachers.map(prof => {
    const d = teacherData[prof];
    totalClasses += d.classesCount;
    totalFat += d.faturamento;
    totalComm += d.commission;

    return `
      <tr>
        <td><strong>${prof}</strong></td>
        <td class="text-center">${d.classesCount}</td>
        <td class="text-right">${formatCurrency(d.faturamento)}</td>
        <td class="text-right font-semibold">${formatCurrency(d.commission)}</td>
      </tr>
    `;
  }).join('');

  // Add a total row
  html += `
    <tr class="table-total-row" style="background: rgba(255,255,255,0.05); font-weight:700;">
      <td>Total Geral</td>
      <td class="text-center">${totalClasses}</td>
      <td class="text-right">${formatCurrency(totalFat)}</td>
      <td class="text-right">${formatCurrency(totalComm)}</td>
    </tr>
  `;

  reportCommissionsRows.innerHTML = html;
}

function renderReportCharts() {
  if (cachedMonthsLabels.length === 0) return;

  renderChartRevenueHistory(
    cachedMonthsLabels, 
    cachedHistoricalRevenue, 
    cachedHistoricalStudents, 
    'report-chart-revenue-history', 
    'reportRevenueHistory'
  );
  renderChartSubcategories(
    cachedProcessedSubData, 
    'report-chart-subcategory', 
    'reportSubcategories'
  );
  renderChartOccupancyHistory(
    cachedMonthsLabels, 
    cachedOccupancyHistoryPct, 
    'report-chart-occupancy', 
    'reportOccupancyHistory'
  );
  renderChartTicketHistory(
    cachedMonthsLabels, 
    cachedTicketMedioHistory, 
    'report-chart-ticket-history', 
    'reportTicketHistory'
  );
}

function syncCommentsToPrint() {
  const commTa = document.getElementById('report-commissions-comment');
  const commPr = document.getElementById('report-commissions-comment-print');
  if (commTa && commPr) commPr.innerText = commTa.value || '';

  const opTa = document.getElementById('report-operational-comment');
  const opPr = document.getElementById('report-operational-comment-print');
  if (opTa && opPr) opPr.innerText = opTa.value || '';

  const finTa = document.getElementById('report-financial-comment');
  const finPr = document.getElementById('report-financial-comment-print');
  if (finTa && finPr) finPr.innerText = finTa.value || '';
}

// Bind live comment syncing
function setupCommentSyncHandlers() {
  const setupSync = (textareaId, printId) => {
    const ta = document.getElementById(textareaId);
    const pr = document.getElementById(printId);
    if (ta && pr) {
      ta.addEventListener('input', (e) => {
        pr.innerText = e.target.value;
      });
    }
  };
  setupSync('report-commissions-comment', 'report-commissions-comment-print');
  setupSync('report-operational-comment', 'report-operational-comment-print');
  setupSync('report-financial-comment', 'report-financial-comment-print');
}

// Bind Export PDF Button click
const btnExportReportPdf = document.getElementById('btn-export-report-pdf');
if (btnExportReportPdf) {
  btnExportReportPdf.addEventListener('click', () => {
    const year = selectYear.value;
    const month = selectMonth.value;
    const monthStart = `${year}-${month}-01`;
    const oldTitle = document.title;
    document.title = `Montreal Tenis - Relatorio Mensal - ${getMonthNameBR(monthStart)}_${year}`;
    
    // Sync all comments right before printing to ensure they are up to date
    syncCommentsToPrint();
    
    window.print();
    document.title = oldTitle;
  });
}

// Initialize comment listeners
setupCommentSyncHandlers();

// ---- Agenda de Recebíveis Upload & Persistência ----
async function supabaseUpsert(table, row) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  debugLog(`[REST] POST (UPSERT) ${url}`, row);
  const token = getUserToken() || SUPABASE_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST upsert error ${res.status}: ${body}`);
  }
  return true;
}

async function supabaseDeleteByMonth(table, yearMonth) {
  const monthStart = `${yearMonth}-01`;
  const monthEnd = getEndOfMonth(monthStart);
  const url = `${SUPABASE_URL}/rest/v1/${table}?data_liberacao=gte.${monthStart}&data_liberacao=lte.${monthEnd}`;
  debugLog(`[REST] DELETE (MONTH) ${url}`);
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
    throw new Error(`Supabase REST delete month error ${res.status}: ${body}`);
  }
  return true;
}

function initReceivablesUpload() {
  const fileInput = document.getElementById('receivables-file-input');
  const btnTrigger = document.getElementById('btn-trigger-upload');
  const btnClear = document.getElementById('btn-clear-receivables');
  const statusMsg = document.getElementById('upload-status-msg');

  if (!fileInput || !btnTrigger || !statusMsg) return;

  btnTrigger.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      const year = selectYear.value;
      const month = selectMonth.value;
      const yearMonth = `${year}-${month}`;
      
      showUploadStatus(`Limpando importações de ${yearMonth}...`, 'info');
      
      try {
        await supabaseDeleteByMonth('mt_agenda_recebiveis_importada', yearMonth);
        showUploadStatus(`Sucesso! Importações de recebíveis limpas para o período ${yearMonth}.`, 'success');
        
        if (typeof handleFilterChange === 'function') {
          await handleFilterChange();
        }
      } catch (err) {
        showUploadStatus(`Erro ao limpar: ${err.message}`, 'error');
      }
    });
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showUploadStatus('Lendo arquivo...', 'info');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length === 0) {
          throw new Error('O arquivo selecionado está vazio.');
        }

        // Buscar cabeçalho
        let headerIndex = -1;
        let dateColIndex = -1;
        let valColIndex = -1;

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;

          const stringRow = row.map(cell => String(cell || '').toLowerCase().trim());

          const dateIdx = stringRow.findIndex(cell => 
            cell === 'data' || cell === 'date' || cell === 'data prevista' || 
            cell === 'prevision_payment_date' || cell === 'data_liberacao' || cell === 'liberacao' ||
            cell.includes('data previsto') || cell.includes('vencimento')
          );

          const valIdx = stringRow.findIndex(cell => 
            cell === 'valor' || cell === 'valor liquido' || cell === 'liquido' || 
            cell === 'net_amount' || cell === 'valor_recebido' || cell === 'valor_pago' ||
            cell.includes('valor líq') || cell.includes('líquido') || cell === 'valor_liquido' ||
            cell === 'valor bruto' || cell === 'bruto' || cell === 'gross_amount' || cell === 'amount'
          );

          if (dateIdx !== -1 && valIdx !== -1) {
            headerIndex = i;
            dateColIndex = dateIdx;
            valColIndex = valIdx;
            break;
          }
        }

        if (headerIndex === -1) {
          throw new Error("Não foi possível identificar as colunas de 'Data' e 'Valor' no arquivo.");
        }

        const credenciadora = 'consolidado';
        const dailyData = {};

        for (let i = headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row[dateColIndex] === undefined || row[valColIndex] === undefined) continue;

          const rawDate = row[dateColIndex];
          const rawVal = row[valColIndex];

          const parsedDate = parseRowDate(rawDate);
          if (!parsedDate) continue;

          const parsedVal = parseRowValue(rawVal);
          if (isNaN(parsedVal)) continue;

          dailyData[parsedDate] = (dailyData[parsedDate] || 0.0) + parsedVal;
        }

        const dates = Object.keys(dailyData);
        if (dates.length === 0) {
          throw new Error('Nenhum dado válido de Data e Valor foi encontrado nas linhas do arquivo.');
        }

        showUploadStatus(`Enviando ${dates.length} registros para o Supabase...`, 'info');

        const recordsToUpsert = dates.map(dt => ({
          data_liberacao: dt,
          credenciadora: credenciadora,
          valor: Math.round(dailyData[dt] * 100) / 100,
          arquivo_origem: file.name
        }));

        const batchSize = 100;
        for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
          const batch = recordsToUpsert.slice(i, i + batchSize);
          await supabaseUpsert('mt_agenda_recebiveis_importada', batch);
        }

        showUploadStatus(`Sucesso! ${dates.length} datas importadas de recebíveis consolidada.`, 'success');
        
        if (typeof handleFilterChange === 'function') {
          await handleFilterChange();
        }

      } catch (err) {
        showUploadStatus(err.message, 'error');
      }
    };

    reader.onerror = () => {
      showUploadStatus('Erro ao ler o arquivo físico.', 'error');
    };

    reader.readAsArrayBuffer(file);
  });

  function showUploadStatus(msg, type) {
    statusMsg.innerText = msg;
    statusMsg.style.display = 'block';
    
    if (type === 'error') {
      statusMsg.style.background = 'rgba(230, 57, 70, 0.15)';
      statusMsg.style.color = '#e63946';
      statusMsg.style.border = '1px solid rgba(230, 57, 70, 0.3)';
    } else if (type === 'success') {
      statusMsg.style.background = 'rgba(46, 196, 182, 0.15)';
      statusMsg.style.color = '#2ec4b6';
      statusMsg.style.border = '1px solid rgba(46, 196, 182, 0.3)';
    } else { // info
      statusMsg.style.background = 'rgba(233, 196, 106, 0.1)';
      statusMsg.style.color = '#e9c46a';
      statusMsg.style.border = '1px solid rgba(233, 196, 106, 0.2)';
    }
  }

  function parseRowDate(dateValue) {
    if (typeof dateValue === 'number' || !isNaN(Number(dateValue))) {
      const date = XLSX.SSF.parse_date_code(Number(dateValue));
      if (date && date.y && date.m && date.d) {
        const y = date.y;
        const m = String(date.m).padStart(2, '0');
        const d = String(date.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    
    const str = String(dateValue).trim();
    const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (brMatch) {
      let d = brMatch[1].padStart(2, '0');
      let m = brMatch[2].padStart(2, '0');
      let y = brMatch[3];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
    
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      let y = isoMatch[1];
      let m = isoMatch[2].padStart(2, '0');
      let d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    return null;
  }

  function parseRowValue(valValue) {
    if (typeof valValue === 'number') return valValue;
    
    let clean = String(valValue)
      .replace(/R\$\s?/gi, '')
      .trim();
    
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    
    return parseFloat(clean);
  }
}

// Iniciar a escuta do upload
initReceivablesUpload();


