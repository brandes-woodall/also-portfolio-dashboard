import { NextResponse } from 'next/server';

const parseNum = (s: string) => parseFloat((s || '').replace(/[$,%x ]/g, '')) || 0;
const parsePct = (s: string) => {
  const cleaned = (s || '').replace(/[% ]/g, '');
  return parseFloat(cleaned) / 100 || 0;
};

// ── Sheet IDs ────────────────────────────────────────────────────────────────
const DASHBOARD_SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID!;
const TRACK_RECORD_SHEET_ID = process.env.TRACK_RECORD_SHEET_ID || '1depwL5A8lDHBgLohm3XirkuqaFjrgx57yyPC7sbr4Gg';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY!;

// Legal name now comes from Column I of the Portfolio Dashboard sheet.
// No more hardcoded NAME_MAP needed.

// ── Fetch helper ─────────────────────────────────────────────────────────────
async function fetchSheet(sheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.values || []) as string[][];
}

// ── Track Record column layout ───────────────────────────────────────────────
// Columns 1-16 are identical across all three fund tabs.
// HOWEVER, Co-Investments has an extra "Paid-In Capital" column at position 17,
// which shifts MOIC, Shares Outstanding, and Ownership by +1.
//
// Fund II / Fund III:              Co-Investments:
//   17: Realized / Unrealized Gain   17: Paid-In Capital
//   18: MOIC                          18: Realized / Unrealized Gain
//   19: Total Shares Outstanding      19: MOIC
//   20: Current Tranche Ownership     20: Total Shares Outstanding
//   21: Initial Tranche Ownership     21: Current Tranche Ownership
//                                     22: Initial Tranche Ownership
//
// We detect this automatically by reading the header row.

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
}

function parseTranches(rows: string[][], headerRow: number, dataStartRow: number): Tranche[] {
  // Find column indices from the header row
  const headers = rows[headerRow] || [];
  let colMOIC = -1, colSharesOut = -1, colOwnership = -1, colVehicleName = -1, colStage = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').trim();
    if (h === 'MOIC') colMOIC = i;
    else if (h === 'Total Shares Outstanding') colSharesOut = i;
    else if (h === 'Current Tranche Ownership') colOwnership = i;
    else if (h === 'Vehicle Name') colVehicleName = i;
    else if (h === 'Stage') colStage = i;
  }
  // "Vehicle Name" and "Stage" may be in a merged header row above the main header
  if ((colVehicleName === -1 || colStage === -1) && headerRow > 0) {
    const aboveRow = rows[headerRow - 1] || [];
    for (let i = 0; i < aboveRow.length; i++) {
      const h = (aboveRow[i] || '').trim();
      if (h === 'Vehicle Name' && colVehicleName === -1) colVehicleName = i;
      else if (h === 'Stage' && colStage === -1) colStage = i;
    }
  }
  // Fallback to Fund II/III defaults if headers weren't found
  if (colMOIC === -1) colMOIC = 18;
  if (colSharesOut === -1) colSharesOut = 19;
  if (colOwnership === -1) colOwnership = 20;

  const tranches: Tranche[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[1] || '').trim();
    if (!name || name.startsWith('Total') || name === 'Investment') break;
    tranches.push({
      legalName:         name,
      instrument:        r[2] || '',
      type:              r[3] || '',
      investDate:        r[4] || '',
      investmentAmount:  parseNum(r[6]),
      postMoneyCap:      parseNum(r[7]),
      shares:            parseNum(r[8]),
      issuePrice:        parseNum(r[9]),
      sharesOwned:       parseNum(r[12]),
      currentPrice:      parseNum(r[13]),
      residualValue:     parseNum(r[15]),
      totalValue:        parseNum(r[16]),
      moic:              parseNum(r[colMOIC]),
      sharesOutstanding: parseNum(r[colSharesOut]),
      currentOwnership:  parsePct(r[colOwnership]),
      vehicleName:       colVehicleName >= 0 ? (r[colVehicleName] || '').trim() : '',
      stage:             colStage >= 0 ? (r[colStage] || '').trim() : '',
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

    if (dashRows.length === 0) return NextResponse.json({ companies: [], fundSizes: { ac2: 0, ac3: 0 } });

    // ── 2. Fetch the Track Record fund tabs + summary ─────────────────────
    // All three fund tabs share the same layout:
    // Row 1: Fund title, Row 2: subtitle, Row 3: "As of" date, Row 4: blank, Row 5: headers
    // Row 6+: data (company tranches)
    // → array index 5 = first data row when fetching from A1
    const [f2Rows, f3Rows, ciRows, trSummaryRows] = await Promise.all([
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Fund II'!A1:W50"),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Fund III'!A1:W30"),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Co-Investments'!A1:AH30"),
      fetchSheet(TRACK_RECORD_SHEET_ID, "'Track Record'!A1:F50"),
    ]);

    // ── 2b. Parse committed capital from Track Record summary tab ────────
    // Rows contain: ["", "Fund II/III", "Committed Capital: ", "", " $ XX,XXX,XXX "]
    // We find rows with "Committed Capital" and read the fund name + value
    let ac2FundSize = 0;
    let ac3FundSize = 0;
    for (const row of trSummaryRows) {
      const hasCommitted = row.some(cell => (cell || '').includes('Committed Capital'));
      if (!hasCommitted) continue;
      const fundLabel = (row[1] || '').trim();
      // The value is in the next non-empty cell after "Committed Capital"
      const valueCell = row.find((cell, idx) => idx > 2 && cell && cell.trim().startsWith('$'));
      const fundSize = valueCell ? parseNum(valueCell) : 0;
      if (fundLabel === 'Fund III') ac3FundSize = fundSize;
      else if (fundLabel === 'Fund II') ac2FundSize = fundSize;
    }

    // Header row is at index 4 (row 5 in sheet), data starts at index 5 (row 6)
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
        const f2Company: Tranche[] = [];
        const f3Company: Tranche[] = [];
        const ciCompany: Tranche[] = [];
        for (const ln of legalNames) {
          if (f2ByName[ln]) f2Company.push(...f2ByName[ln]);
          if (f3ByName[ln]) f3Company.push(...f3ByName[ln]);
          if (ciByName[ln]) ciCompany.push(...ciByName[ln]);
        }

        const ac2  = aggregateTranches(f2Company);
        const ac3  = aggregateTranches(f3Company);
        const catalyst = aggregateTranches(ciCompany);

        // Shares outstanding should be the same across funds for a company
        const sharesOutstanding = Math.max(ac2.sharesOutstanding, ac3.sharesOutstanding, catalyst.sharesOutstanding);
        // Current price: use the highest (most recent priced round)
        const pricePerShare = Math.max(ac2.currentPrice, ac3.currentPrice, catalyst.currentPrice);

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
      fundSizes: { ac2: ac2FundSize, ac3: ac3FundSize },
    });
  } catch (e) {
    console.error('Portfolio API error:', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
