import { NextResponse } from 'next/server';

const parseNum = (s: string) => parseFloat((s || '').replace(/[$,%x ]/g, '')) || 0;
// Handles both formatted ("5.00%") and unformatted (raw decimal "0.05") values.
const parsePct = (s: string) => {
  const str = (s || '').trim();
  if (!str) return 0;
  if (str.includes('%')) return parseFloat(str.replace(/[% ]/g, '')) / 100 || 0;
  return parseFloat(str) || 0;
};

// ── Sheet IDs ────────────────────────────────────────────────────────────────
// Source of truth for company identity (do NOT edit this sheet)
const PORTFOLIO_COMPANIES_SHEET_ID = '1YYUnPtsWURRN2G5Y5XezQSliUlY5WTsAGM6Qx_rNMZw';
const TRACK_RECORD_SHEET_ID = process.env.TRACK_RECORD_SHEET_ID || '1CzUwhToTXvBx-ott14vSY4_ebRPD48DPuVTSIUgNRdw';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY!;

// All company tabs in the Fundraising Strategy Guide sheet
// (used for batch-fetching lead investor data)
const COMPANY_TAB_NAMES = [
  'Vital Lyfe','Vast','Varda','Trellis','Tomos Devices','Tandem',
  'Spec','Strata','Sentient Machines','Sea12','River','Remento',
  'Radiant','Polyphron','Observed Matter','Northwood','Nexa','Neion',
  'Nebex','NanduX','Mobius','Mesh Optical','Mantari','Maka Media',
  'Loci','Lazarus','Kyma','Keyframe','K2 Space','Julumuqi',
  'International Autonomy','Integral','Higlo','Halltech','Grounded',
  'GrayPass','General Intelligence Labs','Galadyne','Fyn','Freckle',
  'Fluidstack','Float Health','Eridale','Enoda','Drift Robotics',
  'Crew','Cosmic Robotics','ConductorAI','Ceres','Cala','Blitz',
  'Biosphere','Bels','Atolla Skin Health','Atlas','Aran','Aptamino',
  'AnySignal','Andrenam','a37','4D Surgical',
];

// Batch-fetch the INVESTORS section from every company tab.
// Returns: { [companyName]: { [roundName]: leadFirmNames[] } }
async function fetchCompanyLeads(): Promise<Record<string, Record<string, string[]>>> {
  const rangeParams = COMPANY_TAB_NAMES.map(
    name => `ranges=${encodeURIComponent(`'${name}'!A1:F60`)}`
  ).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${PORTFOLIO_COMPANIES_SHEET_ID}/values:batchGet?${rangeParams}&key=${API_KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, Record<string, string[]>> = {};
    for (const vr of (data.valueRanges || [])) {
      const rangeStr = (vr.range || '') as string;
      const tabName = rangeStr.split('!')[0].replace(/'/g, '');
      const rows = ((vr.values || []) as string[][]);
      let inInvestors = false;
      let pastHeader = false;
      const leads: Record<string, string[]> = {};
      for (const row of rows) {
        const col0 = (row[0] || '').trim();
        if (col0 === 'INVESTORS') { inInvestors = true; continue; }
        if (!inInvestors) continue;
        if (!pastHeader) { pastHeader = true; continue; } // skip header row
        const firm  = (row[0] || '').trim();
        const round = (row[2] || '').trim();
        const role  = (row[3] || '').trim().toLowerCase();
        if (!firm || !round) continue;
        if (role === 'lead' || role === 'co-lead') {
          if (!leads[round]) leads[round] = [];
          if (!leads[round].includes(firm)) leads[round].push(firm);
        }
      }
      result[tabName] = leads;
    }
    return result;
  } catch { return {}; }
}

// ── Fetch helper ─────────────────────────────────────────────────────────────
async function fetchSheet(sheetId: string, range: string, unformatted = false) {
  // UNFORMATTED_VALUE preserves full precision on dollar amounts (no rounding
  // to whole dollars based on cell display format). We pair it with
  // FORMATTED_STRING for dates so investDate stays human-readable instead of
  // becoming a Sheets serial number.
  const renderOpt = unformatted
    ? '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING'
    : '';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}${renderOpt}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  // Unformatted mode returns numbers/booleans; coerce to string so downstream
  // parsers (parseNum / .trim() / .startsWith()) keep working unchanged.
  const rows = (data.values || []) as unknown[][];
  return rows.map(r => r.map(v => v == null ? '' : String(v))) as string[][];
}

// ── Track Record column layout ───────────────────────────────────────────────
// Columns 1-9 are identical across all fund tabs.
// HOWEVER, columns shift across tabs:
//   - Fund II / Fund III: standard layout (MOIC at 18)
//   - Co-Investments: has an extra "Paid-In Capital" column at position 17,
//     shifting MOIC / Shares Outstanding / Ownership by +1.
//   - Fund I: has FOUR extra "Transaction" columns (Date of First/Second
//     Transaction, First/Second PPS) inserted between cols 9 and 16, which
//     shifts Number of Shares Owned, Current Price, Realized Value, Residual
//     Value, Total Value, Paid-In Capital, MOIC, Shares Outstanding, Ownership,
//     and Stage. MOIC ends up at col 25.
//
// We detect all variable column positions automatically by reading the header
// row (with a fallback to the Fund II/III defaults).

interface Tranche {
  legalName: string;
  instrument: string;
  type: string;
  investDate: string;
  investmentAmount: number;
  postMoneyCap: number;
  shares: number;
  issuePrice: number;
  sharesOwned: number;
  currentPrice: number;
  residualValue: number;
  totalValue: number;
  moic: number;
  sharesOutstanding: number;
  currentOwnership: number;
  vehicleName: string;
  stage: string;
  leadInvestor: string;
  notableCoInvestors: string;
}

function parseTranches(rows: string[][], headerRow: number, dataStartRow: number): Tranche[] {
  // Look up column indices from the header row, falling back to a merged
  // header row above (used for grouped headers like "Vehicle Name").
  const headers = rows[headerRow] || [];
  const aboveRow = headerRow > 0 ? (rows[headerRow - 1] || []) : [];
  const findCol = (...names: string[]): number => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const name of names) {
      const target = norm(name);
      for (let i = 0; i < headers.length; i++) {
        if (norm(headers[i] || '') === target) return i;
      }
      for (let i = 0; i < aboveRow.length; i++) {
        if (norm(aboveRow[i] || '') === target) return i;
      }
    }
    return -1;
  };

  // Pick header-detected column when available; otherwise use the Fund II/III
  // default index. This keeps existing tabs working while supporting Fund I's
  // wider layout (which inserts "Transaction" columns shifting cols 12-22).
  const pick = (detected: number, fallback: number) => detected >= 0 ? detected : fallback;
  const colName        = pick(findCol('Investment'), 1);
  const colInstrument  = pick(findCol('Original Instrument'), 2);
  const colType        = pick(findCol('Type'), 3);
  const colInvestDate  = pick(findCol('Investment Date'), 4);
  const colAmount      = pick(findCol('Investment Amount'), 6);
  const colPostMoney   = pick(findCol('Post-Money Cap / Valuation', 'Post-Money Cap'), 7);
  const colShares      = pick(findCol('Number of Shares'), 8);
  const colIssuePrice  = pick(findCol('Issue Price per Share'), 9);
  const colSharesOwned = pick(findCol('Number of Shares Owned'), 12);
  const colCurrentPrice = pick(findCol('Current Price per Share'), 13);
  const colResidual    = pick(findCol('Residual Value'), 15);
  const colTotalValue  = pick(findCol('Total Value'), 16);
  const colMOIC        = pick(findCol('MOIC'), 18);
  const colSharesOut   = pick(findCol('Total Shares Outstanding'), 19);
  const colOwnership   = pick(findCol('Current Tranche Ownership'), 20);
  const colVehicleName    = findCol('Vehicle Name');           // optional
  const colStage          = findCol('Stage');                  // optional
  const colLeadInvestor   = findCol('Lead Investor', 'Lead Investors');
  const colCoInvestors    = findCol('Notable Co-Investors', 'Notable Co Investors', 'Co-Investors', 'Co Investors', 'Notable CoInvestors');

  const tranches: Tranche[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[colName] || '').trim();
    if (!name || name.startsWith('Total') || name === 'Investment') break;
    tranches.push({
      legalName:         name,
      instrument:        r[colInstrument] || '',
      type:              r[colType] || '',
      investDate:        r[colInvestDate] || '',
      investmentAmount:  parseNum(r[colAmount]),
      postMoneyCap:      parseNum(r[colPostMoney]),
      shares:            parseNum(r[colShares]),
      issuePrice:        parseNum(r[colIssuePrice]),
      sharesOwned:       parseNum(r[colSharesOwned]),
      currentPrice:      parseNum(r[colCurrentPrice]),
      residualValue:     parseNum(r[colResidual]),
      totalValue:        parseNum(r[colTotalValue]),
      moic:              parseNum(r[colMOIC]),
      sharesOutstanding: parseNum(r[colSharesOut]),
      currentOwnership:  parsePct(r[colOwnership]),
      vehicleName:         colVehicleName >= 0 ? (r[colVehicleName] || '').trim() : '',
      stage:               colStage >= 0 ? (r[colStage] || '').trim() : '',
      leadInvestor:        colLeadInvestor >= 0 ? (r[colLeadInvestor] || '').trim() : '',
      notableCoInvestors:  colCoInvestors >= 0 ? (r[colCoInvestors] || '').trim() : '',
    });
  }
  return tranches;
}

// ── Aggregate tranches for a single company in a single fund ─────────────────
interface FundSummary {
  investment: number;
  shares: number;
  currentValue: number;   // Total Value (realized + unrealized) — used for MOIC
  residualValue: number;  // Residual Value (unrealized only) — used for AUM
  moic: number;
  ownership: number;
  sharesOutstanding: number;
  currentPrice: number;
  safeCap: number;        // post-money cap for SAFE investments
  tranches: {
    instrument: string;
    type: string;
    investDate: string;
    amount: number;
    postMoneyCap: number;
    shares: number;
    currentPrice: number;
    value: number;
    moic: number;
    vehicleName: string;
    stage: string;
    leadInvestor: string;
    notableCoInvestors: string;
  }[];
}

function aggregateTranches(tranches: Tranche[]): FundSummary {
  if (tranches.length === 0) {
    return { investment: 0, shares: 0, currentValue: 0, residualValue: 0, moic: 0, ownership: 0, sharesOutstanding: 0, currentPrice: 0, safeCap: 0, tranches: [] };
  }

  let totalInvestment = 0;
  let totalShares = 0;
  let totalValue = 0;
  let totalResidual = 0;
  let totalOwnership = 0;
  // Use the largest shares outstanding value (they should all be the same for a company)
  let sharesOutstanding = 0;
  // Use the most recent current price
  let currentPrice = 0;
  // Sum SAFE caps for unconverted SAFEs (shares = 0 means still a SAFE)
  let safeCap = 0;

  const trancheDetails = tranches.map(t => {
    totalInvestment += t.investmentAmount;
    totalShares += t.sharesOwned;
    totalValue += t.totalValue;
    totalResidual += t.residualValue;
    totalOwnership += t.currentOwnership;
    if (t.sharesOutstanding > sharesOutstanding) sharesOutstanding = t.sharesOutstanding;
    if (t.currentPrice > 0) currentPrice = t.currentPrice;

    // SAFE: no shares owned and has a post-money cap
    if (t.sharesOwned === 0 && t.postMoneyCap > 0 && t.instrument === 'SAFE') {
      safeCap += t.postMoneyCap;
    }

    return {
      instrument: t.instrument,
      type: t.type,
      investDate: t.investDate,
      amount: t.investmentAmount,
      postMoneyCap: t.postMoneyCap,
      shares: t.sharesOwned,
      currentPrice: t.currentPrice,
      value: t.totalValue,
      moic: t.moic,
      vehicleName: t.vehicleName,
      stage: t.stage,
      leadInvestor: t.leadInvestor,
      notableCoInvestors: t.notableCoInvestors,
    };
  });

  const moic = totalInvestment > 0 ? totalValue / totalInvestment : 0;

  return {
    investment: totalInvestment,
    shares: totalShares,
    currentValue: totalValue,
    residualValue: totalResidual,
    moic,
    ownership: totalOwnership,
    sharesOutstanding,
    currentPrice,
    safeCap,
    tranches: trancheDetails,
  };
}

// Type alias for a tranche detail record (mirrors the inline type in FundSummary)
type TrancheDetail = FundSummary['tranches'][number];

// Apply lead investor data (from company tabs) to already-aggregated tranche details.
// Matches by stage first; falls back to a case-insensitive instrument substring match.
// Only fills in leadInvestor if it isn't already populated from the Track Record tab.
function applyLeadsTranches(
  tranches: TrancheDetail[],
  compLeads: Record<string, string[]>
): TrancheDetail[] {
  if (!Object.keys(compLeads).length) return tranches;
  return tranches.map(t => {
    const existing = (t.leadInvestor || '').trim();
    // Build candidate lead list by stage, then by instrument substring
    const lead =
      compLeads[t.stage] ||
      Object.entries(compLeads).find(([k]) =>
        t.instrument.toLowerCase().includes(k.toLowerCase())
      )?.[1] ||
      null;
    if (lead && lead.length > 0 && !existing) {
      return { ...t, leadInvestor: lead.join(', ') };
    }
    return t;
  });
}

export async function GET() {
  try {
    // ── 1. Fetch company list from Portfolio Companies tab ────────────────
    // Sheet: Fundraising Strategy Guide (read-only — NEVER edit)
    // Rows: 1=blank, 2=title "Portfolio Companies", 3=column headers, 4+=data
    const portfolioRows = await fetchSheet(
      PORTFOLIO_COMPANIES_SHEET_ID,
      "'Portfolio Companies'!B1:L200",
      true
    );

    if (portfolioRows.length === 0) {
      return NextResponse.json({
        companies: [],
        fundSizes: { ac1: 0, ac2: 0, ac3: 0, aces0: 0, aces1: 0 },
        fundAUMBreakdown: [],
      });
    }

    // ── 2. Fetch Track Record tabs + AUM summary + company lead investors ─
    const [f1Rows, f2Rows, f3Rows, ciRows, aces0Rows, aces1Rows, trSummaryRows, companyLeads] =
      await Promise.all([
        fetchSheet(TRACK_RECORD_SHEET_ID, "'AC \"1\"'!A1:AR60",   true),
        fetchSheet(TRACK_RECORD_SHEET_ID, "'AC 2'!A1:AJ50",       true),
        fetchSheet(TRACK_RECORD_SHEET_ID, "'AC 3'!A1:AJ75",       true),
        fetchSheet(TRACK_RECORD_SHEET_ID, "'C 0'!A1:AQ30",        true),
        fetchSheet(TRACK_RECORD_SHEET_ID, "'ACES \"0\"'!A1:AQ50", true),
        fetchSheet(TRACK_RECORD_SHEET_ID, "'ACES 1'!A1:AQ50",     true),
        // Expanded to P (16 cols) to capture col J (Invested) and col N (RV)
        fetchSheet(TRACK_RECORD_SHEET_ID, "'Track Record'!A1:P200", true),
        fetchCompanyLeads(),
      ]);

    // ── 2b. Parse committed capital from Track Record summary tab ─────────
    // Scan every cell in every row for fund labels, then look for the
    // "Committed Capital" / "Paid-In Capital" row that follows each label.
    // Committed capital is the first value > $1 M found on that row.
    // (Invested and Remaining Value come from the per-fund tranche data below,
    //  which is already parsed from the same Track Record fund tabs.)
    const FUND_KEY_MAP: Record<string, string> = {
      'Fund III': 'ac3', 'AC 3': 'ac3', 'AC3': 'ac3',
      'Fund II':  'ac2', 'AC 2': 'ac2', 'AC2': 'ac2',
      'Fund I':   'ac1', 'AC "1"': 'ac1', 'AC1': 'ac1',
      'C 0': 'catalyst', 'C "0"': 'catalyst',
      'Co-Investments': 'catalyst', 'Co-Investment': 'catalyst',
      'Catalyst': 'catalyst', 'Catalyst 0': 'catalyst',
      'ACES "0"': 'aces0', 'ACES 0': 'aces0',
      'ACES 1': 'aces1',
    };

    let currentFundKey = '';
    const committedMap: Record<string, number> = {};

    for (const row of trSummaryRows) {
      // Identify a fund label anywhere in the row
      for (const cell of row) {
        const c = (cell || '').trim();
        if (FUND_KEY_MAP[c]) { currentFundKey = FUND_KEY_MAP[c]; break; }
      }
      // Check if this row declares a committed / paid-in capital amount
      const hasCapital = row.some(c =>
        (c || '').includes('Committed Capital') || (c || '').includes('Paid-In Capital')
      );
      if (hasCapital && currentFundKey && !committedMap[currentFundKey]) {
        for (const cell of row) {
          const v = parseNum(cell || '');
          if (v > 1_000_000) { committedMap[currentFundKey] = v; break; }
        }
      }
    }

    // ── 2c. Parse fund tranches ───────────────────────────────────────────
    // Header row is at index 4 (row 5 in sheet), data starts at index 5 (row 6)
    const f1Tranches    = parseTranches(f1Rows,    4, 5);
    const f2Tranches    = parseTranches(f2Rows,    4, 5);
    const f3Tranches    = parseTranches(f3Rows,    4, 5);
    const ciTranches    = parseTranches(ciRows,    4, 5);
    const aces0Tranches = parseTranches(aces0Rows, 4, 5);
    const aces1Tranches = parseTranches(aces1Rows, 4, 5);

    // ── 2d. Build fund-level AUM breakdown ───────────────────────────────
    // Invested and Remaining Value are summed directly from the parsed tranches
    // (same data source as Track Record col J / col N; avoids column-index guessing
    //  on the summary tab whose layout we don't fully control).
    const fundInvested: Record<string, number> = {
      ac1:      f1Tranches.reduce((s, t) => s + t.investmentAmount, 0),
      ac2:      f2Tranches.reduce((s, t) => s + t.investmentAmount, 0),
      ac3:      f3Tranches.reduce((s, t) => s + t.investmentAmount, 0),
      catalyst: ciTranches.reduce((s, t) => s + t.investmentAmount, 0),
      aces0:    aces0Tranches.reduce((s, t) => s + t.investmentAmount, 0),
      aces1:    aces1Tranches.reduce((s, t) => s + t.investmentAmount, 0),
    };
    const fundRV: Record<string, number> = {
      ac1:      f1Tranches.reduce((s, t) => s + t.residualValue, 0),
      ac2:      f2Tranches.reduce((s, t) => s + t.residualValue, 0),
      ac3:      f3Tranches.reduce((s, t) => s + t.residualValue, 0),
      catalyst: ciTranches.reduce((s, t) => s + t.residualValue, 0),
      aces0:    aces0Tranches.reduce((s, t) => s + t.residualValue, 0),
      aces1:    aces1Tranches.reduce((s, t) => s + t.residualValue, 0),
    };
    const FUND_DISPLAY: Record<string, string> = {
      ac1: 'AC1', ac2: 'AC2', ac3: 'AC3',
      catalyst: 'Catalyst 0', aces0: 'ACES 0', aces1: 'ACES 1',
    };

    interface FundAUMRow {
      label: string; committed: number; invested: number;
      uninvested: number; remainingValue: number; fundAUM: number;
    }
    const fundAUMBreakdown: FundAUMRow[] = (
      ['ac1','ac2','ac3','catalyst','aces0','aces1'] as const
    )
      .filter(k => (fundInvested[k] || 0) > 0 || (committedMap[k] || 0) > 0)
      .map(k => {
        const committed  = committedMap[k] || 0;
        const invested   = fundInvested[k] || 0;
        const rv         = fundRV[k] || 0;
        const uninvested = Math.max(0, committed - invested);
        return { label: FUND_DISPLAY[k], committed, invested, uninvested, remainingValue: rv, fundAUM: rv + uninvested };
      });

    const ac1FundSize   = committedMap['ac1']   || 0;
    const ac2FundSize   = committedMap['ac2']   || 0;
    const ac3FundSize   = committedMap['ac3']   || 0;
    const aces0FundSize = committedMap['aces0'] || 0;
    const aces1FundSize = committedMap['aces1'] || 0;

    // ── 3. Group tranches by legal name per fund ──────────────────────────
    const groupByName = (tranches: Tranche[]) => {
      const map: Record<string, Tranche[]> = {};
      for (const t of tranches) {
        (map[t.legalName] ??= []).push(t);
      }
      return map;
    };

    const f1ByName    = groupByName(f1Tranches);
    const f2ByName    = groupByName(f2Tranches);
    const f3ByName    = groupByName(f3Tranches);
    const ciByName    = groupByName(ciTranches);
    const aces0ByName = groupByName(aces0Tranches);
    const aces1ByName = groupByName(aces1Tranches);

    // ── 4. Merge portfolio rows with Track Record + lead investor data ─────
    const companies = portfolioRows
      .slice(3) // skip blank row + "Portfolio Companies" title row + header row
      .filter((row: string[]) => row[0])
      .map((row: string[]) => {
        const colloquialName = row[0] || '';
        const legalName = (row[7] || '').trim();
        const legalNames = legalName ? [legalName] : [colloquialName];

        const f1Company: Tranche[]    = [];
        const f2Company: Tranche[]    = [];
        const f3Company: Tranche[]    = [];
        const ciCompany: Tranche[]    = [];
        const aces0Company: Tranche[] = [];
        const aces1Company: Tranche[] = [];
        for (const ln of legalNames) {
          if (f1ByName[ln])    f1Company.push(...f1ByName[ln]);
          if (f2ByName[ln])    f2Company.push(...f2ByName[ln]);
          if (f3ByName[ln])    f3Company.push(...f3ByName[ln]);
          if (ciByName[ln])    ciCompany.push(...ciByName[ln]);
          if (aces0ByName[ln]) aces0Company.push(...aces0ByName[ln]);
          if (aces1ByName[ln]) aces1Company.push(...aces1ByName[ln]);
        }

        const ac1      = aggregateTranches(f1Company);
        const ac2      = aggregateTranches(f2Company);
        const ac3      = aggregateTranches(f3Company);
        const catalyst = aggregateTranches(ciCompany);
        const aces0    = aggregateTranches(aces0Company);
        const aces1    = aggregateTranches(aces1Company);

        // Overlay lead investors from company-tab INVESTORS sections
        const compLeads = companyLeads[colloquialName] || {};
        ac1.tranches      = applyLeadsTranches(ac1.tranches,      compLeads);
        ac2.tranches      = applyLeadsTranches(ac2.tranches,      compLeads);
        ac3.tranches      = applyLeadsTranches(ac3.tranches,      compLeads);
        catalyst.tranches = applyLeadsTranches(catalyst.tranches, compLeads);
        aces0.tranches    = applyLeadsTranches(aces0.tranches,    compLeads);
        aces1.tranches    = applyLeadsTranches(aces1.tranches,    compLeads);

        const sharesOutstanding = Math.max(
          ac1.sharesOutstanding, ac2.sharesOutstanding, ac3.sharesOutstanding,
          catalyst.sharesOutstanding, aces0.sharesOutstanding, aces1.sharesOutstanding
        );
        const pricePerShare = Math.max(
          ac1.currentPrice, ac2.currentPrice, ac3.currentPrice,
          catalyst.currentPrice, aces0.currentPrice, aces1.currentPrice
        );

        return {
          name:               colloquialName,
          foundingTeam:       row[1] || '',
          linkedin:           row[2] || '',
          emails:             row[3] || '',
          website:            row[4] || '',
          fund:               row[5] || '',
          category:           row[6] || '',
          currentStage:       (row[8] || '').trim(),
          address:            (row[9] || '').trim(),
          legalName:          legalNames[0],
          // ── AC1 ────────────────────────────────────────
          ac1Investment:      ac1.investment,
          ac1SafeCap:         ac1.safeCap,
          ac1Shares:          ac1.shares,
          ac1CurrentValue:    ac1.currentValue,
          ac1ResidualValue:   ac1.residualValue,
          ac1MOIC:            ac1.moic,
          ac1Ownership:       ac1.ownership,
          ac1Tranches:        ac1.tranches,
          // ── AC2 ────────────────────────────────────────
          ac2Investment:      ac2.investment,
          ac2SafeCap:         ac2.safeCap,
          ac2Shares:          ac2.shares,
          ac2CurrentValue:    ac2.currentValue,
          ac2ResidualValue:   ac2.residualValue,
          ac2MOIC:            ac2.moic,
          ac2Ownership:       ac2.ownership,
          ac2Tranches:        ac2.tranches,
          // ── AC3 ────────────────────────────────────────
          ac3Investment:      ac3.investment,
          ac3SafeCap:         ac3.safeCap,
          ac3Shares:          ac3.shares,
          ac3CurrentValue:    ac3.currentValue,
          ac3ResidualValue:   ac3.residualValue,
          ac3MOIC:            ac3.moic,
          ac3Ownership:       ac3.ownership,
          ac3Tranches:        ac3.tranches,
          // ── Catalyst 0 ─────────────────────────────────
          catalystInvestment:    catalyst.investment,
          catalystSafeCap:       catalyst.safeCap,
          catalystShares:        catalyst.shares,
          catalystCurrentValue:  catalyst.currentValue,
          catalystResidualValue: catalyst.residualValue,
          catalystMOIC:          catalyst.moic,
          catalystOwnership:     catalyst.ownership,
          catalystTranches:      catalyst.tranches,
          // ── ACES 0 ─────────────────────────────────────
          aces0Investment:    aces0.investment,
          aces0SafeCap:       aces0.safeCap,
          aces0Shares:        aces0.shares,
          aces0CurrentValue:  aces0.currentValue,
          aces0ResidualValue: aces0.residualValue,
          aces0MOIC:          aces0.moic,
          aces0Ownership:     aces0.ownership,
          aces0Tranches:      aces0.tranches,
          // ── ACES 1 ─────────────────────────────────────
          aces1Investment:    aces1.investment,
          aces1SafeCap:       aces1.safeCap,
          aces1Shares:        aces1.shares,
          aces1CurrentValue:  aces1.currentValue,
          aces1ResidualValue: aces1.residualValue,
          aces1MOIC:          aces1.moic,
          aces1Ownership:     aces1.ownership,
          aces1Tranches:      aces1.tranches,
          // ── Shared ─────────────────────────────────────
          pricePerShare,
          sharesOutstanding,
        };
      });

    return NextResponse.json({
      companies,
      fundSizes: { ac1: ac1FundSize, ac2: ac2FundSize, ac3: ac3FundSize, aces0: aces0FundSize, aces1: aces1FundSize },
      fundAUMBreakdown,
    });
  } catch (e) {
    console.error('Portfolio API error:', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
