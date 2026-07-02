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
const DASHBOARD_SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID!;
const TRACK_RECORD_SHEET_ID = process.env.TRACK_RECORD_SHEET_ID || '16ZO64m6zsnTWsBzQIRBWswxT7GoDV045ps5SBf_QLoU';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY!;

// Legal name now comes from Column I of the Portfolio Dashboard sheet.
// No more hardcoded NAME_MAP needed.

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
  currentValue: number;
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
    return { investment: 0, shares: 0, currentValue: 0, moic: 0, ownership: 0, sharesOutstanding: 0, currentPrice: 0, safeCap: 0, tranches: [] };
  }

  let totalInvestment = 0;
  let totalShares = 0;
  let totalValue = 0;
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
    moic,
    ownership: totalOwnership,
    sharesOutstanding,
    currentPrice,
    safeCap,
    tranches: trancheDetails,
  };
}

export async function GET() {
  try {
    // ── 1. Fetch the Portfolio Dashboard sheet (company identity) ─────────
    const dashRange = 'Sheet1!B3:S100';
    const dashRows = await fetchSheet(DASHBOARD_SHEET_ID, dashRange);

    if (dashRows.length === 0) return NextResponse.json({ companies: [], fundSizes: { ac1: 0, ac2: 0, ac3: 0 } });

    // ── 2. Fetch the Track Record fund tabs + summary ─────────────────────
    // All fund tabs share the same row structure:
    // Row 1: Fund title, Row 2: subtitle, Row 3: "As of" date, Row 4: blank, Row 5: headers
    // Row 6+: data (company tranches)
    // → array index 5 = first data row when fetching from A1
    // (Fund I uses a wider column layout; parseTranches detects this from headers.)
    const [f1Rows, f2Rows, f3Rows, ciRows, trSummaryRows] = await Promise.all([
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Fund I'!A1:AR60", true),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Fund II'!A1:AJ50", true),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Fund III'!A1:AJ30", true),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Co-Investments'!A1:AQ30", true),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Track Record'!A1:F100", true),
    ]);

    // ── 2b. Parse committed capital from Track Record summary tab ────────
    // Rows contain: ["", "Fund I/II/III", "Committed Capital: ", "", " $ XX,XXX,XXX "]
    // We find rows with "Committed Capital" and read the fund name + value
    let ac1FundSize = 0;
    let ac2FundSize = 0;
    let ac3FundSize = 0;
    for (const row of trSummaryRows) {
      const hasCommitted = row.some(cell => (cell || '').includes('Committed Capital'));
      if (!hasCommitted) continue;
      const fundLabel = (row[1] || '').trim();
      // The value is the first numeric cell after column 2. We look for any
      // parseable positive number rather than a leading "$" so this works with
      // both FORMATTED ("$22,000,000") and UNFORMATTED ("22000000") fetches.
      let fundSize = 0;
      for (let idx = 3; idx < row.length; idx++) {
        const v = parseNum(row[idx] || '');
        if (v > 0) { fundSize = v; break; }
      }
      if (fundLabel === 'Fund III') ac3FundSize = fundSize;
      else if (fundLabel === 'Fund II') ac2FundSize = fundSize;
      else if (fundLabel === 'Fund I')  ac1FundSize = fundSize;
    }

    // Header row is at index 4 (row 5 in sheet), data starts at index 5 (row 6)
    const f1Tranches = parseTranches(f1Rows, 4, 5);
    const f2Tranches = parseTranches(f2Rows, 4, 5);
    const f3Tranches = parseTranches(f3Rows, 4, 5);
    const ciTranches = parseTranches(ciRows, 4, 5);

    // ── 3. Group tranches by legal name per fund ─────────────────────────
    const groupByName = (tranches: Tranche[]) => {
      const map: Record<string, Tranche[]> = {};
      for (const t of tranches) {
        (map[t.legalName] ??= []).push(t);
      }
      return map;
    };

    const f1ByName = groupByName(f1Tranches);
    const f2ByName = groupByName(f2Tranches);
    const f3ByName = groupByName(f3Tranches);
    const ciByName = groupByName(ciTranches);

    // ── 4. Merge dashboard rows with Track Record data ───────────────────
    const companies = dashRows
      .slice(1) // skip header row
      .filter((row: string[]) => row[0])
      .map((row: string[]) => {
        const colloquialName = row[0] || '';
        // Range starts at Column B, so B=0, C=1, ... I=7, J=8
        const legalName = (row[7] || '').trim(); // Column I: Legal Name
        const legalNames = legalName ? [legalName] : [colloquialName];

        // Look up tranches for this company across all matching legal names
        const f1Company: Tranche[] = [];
        const f2Company: Tranche[] = [];
        const f3Company: Tranche[] = [];
        const ciCompany: Tranche[] = [];
        for (const ln of legalNames) {
          if (f1ByName[ln]) f1Company.push(...f1ByName[ln]);
          if (f2ByName[ln]) f2Company.push(...f2ByName[ln]);
          if (f3ByName[ln]) f3Company.push(...f3ByName[ln]);
          if (ciByName[ln]) ciCompany.push(...ciByName[ln]);
        }

        const ac1  = aggregateTranches(f1Company);
        const ac2  = aggregateTranches(f2Company);
        const ac3  = aggregateTranches(f3Company);
        const catalyst = aggregateTranches(ciCompany);

        // Shares outstanding should be the same across funds for a company
        const sharesOutstanding = Math.max(ac1.sharesOutstanding, ac2.sharesOutstanding, ac3.sharesOutstanding, catalyst.sharesOutstanding);
        // Current price: use the highest (most recent priced round)
        const pricePerShare = Math.max(ac1.currentPrice, ac2.currentPrice, ac3.currentPrice, catalyst.currentPrice);

        return {
          // Identity from Dashboard sheet
          name:               colloquialName,
          foundingTeam:       row[1] || '',
          linkedin:           row[2] || '',
          emails:             row[3] || '',
          website:            row[4] || '',
          fund:               row[5] || '',
          category:           row[6] || '',
          currentStage:       (row[8] || '').trim(), // Column J: Current Stage
          address:            (row[9] || '').trim(), // Column K: Address
          // Legal name for reference
          legalName:          legalNames[0],
          // ── AC1 (Fund I) from Track Record ─────────────
          ac1Investment:      ac1.investment,
          ac1SafeCap:         ac1.safeCap,
          ac1Shares:          ac1.shares,
          ac1CurrentValue:    ac1.currentValue,
          ac1MOIC:            ac1.moic,
          ac1Ownership:       ac1.ownership,
          ac1Tranches:        ac1.tranches,
          // ── AC2 (Fund II) from Track Record ────────────
          ac2Investment:      ac2.investment,
          ac2SafeCap:         ac2.safeCap,
          ac2Shares:          ac2.shares,
          ac2CurrentValue:    ac2.currentValue,
          ac2MOIC:            ac2.moic,
          ac2Ownership:       ac2.ownership,
          ac2Tranches:        ac2.tranches,
          // ── AC3 (Fund III) from Track Record ───────────
          ac3Investment:      ac3.investment,
          ac3SafeCap:         ac3.safeCap,
          ac3Shares:          ac3.shares,
          ac3CurrentValue:    ac3.currentValue,
          ac3MOIC:            ac3.moic,
          ac3Ownership:       ac3.ownership,
          ac3Tranches:        ac3.tranches,
          // ── Catalyst (Co-Investments) from Track Record ─
          catalystInvestment: catalyst.investment,
          catalystSafeCap:    catalyst.safeCap,
          catalystShares:     catalyst.shares,
          catalystCurrentValue: catalyst.currentValue,
          catalystMOIC:       catalyst.moic,
          catalystOwnership:  catalyst.ownership,
          catalystTranches:   catalyst.tranches,
          // ── Shared ─────────────────────────────────────
          pricePerShare,
          sharesOutstanding,
        };
      });

    return NextResponse.json({
      companies,
      fundSizes: { ac1: ac1FundSize, ac2: ac2FundSize, ac3: ac3FundSize },
    });
  } catch (e) {
    console.error('Portfolio API error:', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
