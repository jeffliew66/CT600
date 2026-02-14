// Simple client-side calculator to mirror the mapping rules
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function toNum(v){ return Number(v) || 0; }
  function roundPounds(n){ return Math.round((Number(n) || 0)); }

  function compute(){
    // Section 1
    const apStart = $("apStart").value;
    const apEnd = $("apEnd").value;
    const assocCompanies = toNum($("assocCompanies").value);

    // Section 2 inputs
    const turnover = toNum($("turnover").value);
    const govtGrants = toNum($("govtGrants").value);
    const rentalIncome = toNum($("rentalIncome").value);
    const interestIncome = toNum($("interestIncome").value);
    const dividendIncome = toNum($("dividendIncome").value);

    const rawMaterials = toNum($("rawMaterials").value);
    const staffCosts = toNum($("staffCosts").value);
    const depreciation = toNum($("depreciation").value);
    const otherCharges = toNum($("otherCharges").value);

    // Section 3 inputs
    const disallowableExpenses = toNum($("disallowableExpenses").value);
    const otherAdjustments = toNum($("otherAdjustments").value);
    const aiaTrade = toNum($("aiaTrade").value);
    const aiaNonTrade = toNum($("aiaNonTrade").value);
    const tradingLossBF = toNum($("tradingLossBF").value);

    // Section 4 inputs
    const rentalLossBF = toNum($("rentalLossBF").value);

    // Section 2 computed
    const totalIncome = turnover + govtGrants + rentalIncome + interestIncome + dividendIncome; // [C]
    const totalExpenses = rawMaterials + staffCosts + depreciation + otherCharges; // [C]
    const profitBeforeTax = totalIncome - totalExpenses; // [C]

    // Quick tax: We'll compute CT using mapping rules (small/marginal/main)

    // Section 3: Trading computations
    // Define tradingProfitBeforeTax as operating trading result (excluding non-op incomes)
    const tradingProfitBeforeTax = turnover - rawMaterials - staffCosts - depreciation - otherCharges;

    const addBacks = depreciation + disallowableExpenses + (otherAdjustments > 0 ? otherAdjustments : 0);
    const deductions = Math.max(0, aiaTrade); // simple: apply AIA trade to allowances

    // tradingLossUsed: min(tradingLossBF, max(0, taxableBeforeLoss))
    const taxableBeforeLoss = tradingProfitBeforeTax + addBacks - deductions;
    const tradingLossUsed = Math.min(tradingLossBF, Math.max(0, taxableBeforeLoss));

    const taxableTradingProfit = Math.max(0, taxableBeforeLoss - tradingLossUsed); // [C]

    // Section 4: property/rental
    const propertyProfitAfterLossOffset = Math.max(0, rentalIncome - rentalLossBF); // [C]
    const netRentalIncome = propertyProfitAfterLossOffset; // [C]

    // Taxable Total Profits (TTP)
    const taxableTotalProfits = taxableTradingProfit + interestIncome + propertyProfitAfterLossOffset; // [C]

    // Augmented profits (for MR) = TTP + dividendIncome
    const augmentedProfits = taxableTotalProfits + dividendIncome;

    // Marginal relief thresholds (simple, not time-apportioned here)
    const smallThreshold = 50000 / (assocCompanies + 1);
    const upperThreshold = 250000 / (assocCompanies + 1);

    // Compute corporation tax
    let corporationTaxCharge = 0;
    let marginalRelief = 0;
    if (taxableTotalProfits <= 0){
      corporationTaxCharge = 0;
    } else if (augmentedProfits <= smallThreshold){
      corporationTaxCharge = taxableTotalProfits * 0.19;
    } else if (augmentedProfits >= upperThreshold){
      corporationTaxCharge = taxableTotalProfits * 0.25;
    } else {
      const main = taxableTotalProfits * 0.25;
      const ratio = augmentedProfits > 0 ? (taxableTotalProfits / augmentedProfits) : 0;
      marginalRelief = 0.015 * (upperThreshold - augmentedProfits) * ratio;
      corporationTaxCharge = main - marginalRelief;
    }

    corporationTaxCharge = Math.max(0, corporationTaxCharge);

    const profitForPeriod = profitBeforeTax - corporationTaxCharge; // [C]

    // Effective tax rate
    const effectiveTaxRate = taxableTotalProfits > 0 ? (corporationTaxCharge / taxableTotalProfits) : 0;

    // Populate readonly fields and attach formula/meta for RHS panel
    const setOut = (id, value, formula, details) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dataset.formula = formula || '';
      el.dataset.details = details || '';
      el.classList.add('clickable');
    };

    setOut('totalIncome', roundPounds(totalIncome), 'turnover + govtGrants + rental + interest + dividend', `= ${turnover} + ${govtGrants} + ${rentalIncome} + ${interestIncome} + ${dividendIncome} = ${roundPounds(totalIncome)}`);
    document.getElementById('totalIncome').dataset.raw = String(totalIncome);
    document.getElementById('totalIncome').dataset.orig = String(roundPounds(totalIncome));
    setOut('totalExpenses', roundPounds(totalExpenses), 'rawMaterials + staff + depreciation + otherCharges', `= ${rawMaterials} + ${staffCosts} + ${depreciation} + ${otherCharges} = ${roundPounds(totalExpenses)}`);
    document.getElementById('totalExpenses').dataset.raw = String(totalExpenses);
    document.getElementById('totalExpenses').dataset.orig = String(roundPounds(totalExpenses));
    const pbtDetail = `STEP-BY-STEP CALCULATION:

Total Income
  = Turnover + Govt Grants + Interest + Rental + Dividend
  = £${roundPounds(turnover).toLocaleString()} + £${roundPounds(govtGrants).toLocaleString()} + £${roundPounds(rentalIncome).toLocaleString()} + £${roundPounds(interestIncome).toLocaleString()} + £${roundPounds(dividendIncome).toLocaleString()}
  = £${roundPounds(totalIncome).toLocaleString()}

Total Expenses
  = Raw Materials + Staff + Depreciation + Other
  = £${roundPounds(rawMaterials).toLocaleString()} + £${roundPounds(staffCosts).toLocaleString()} + £${roundPounds(depreciation).toLocaleString()} + £${roundPounds(otherCharges).toLocaleString()}
  = £${roundPounds(totalExpenses).toLocaleString()}

Profit Before Tax
  = Total Income - Total Expenses
  = £${roundPounds(totalIncome).toLocaleString()} - £${roundPounds(totalExpenses).toLocaleString()}
  = £${roundPounds(profitBeforeTax).toLocaleString()}`;
    setOut('profitBeforeTax', roundPounds(profitBeforeTax), 'Total Income - Total Expenses', pbtDetail);
    document.getElementById('profitBeforeTax').dataset.raw = String(profitBeforeTax);
    document.getElementById('profitBeforeTax').dataset.orig = String(roundPounds(profitBeforeTax));
    const taxFormulaDetail = (() => {
      let detail = `Taxable Profit (TP): £${roundPounds(taxableTotalProfits).toLocaleString()}\n`;
      detail += `Dividend Income: £${roundPounds(dividendIncome).toLocaleString()}\n`;
      detail += `Augmented Profit (AP): TP + Dividends = £${roundPounds(taxableTotalProfits).toLocaleString()} + £${roundPounds(dividendIncome).toLocaleString()} = £${roundPounds(augmentedProfits).toLocaleString()}\n\n`;
      detail += `THRESHOLDS (with associates divisor ${assocCompanies + 1}):\n`;
      detail += `  Small profit threshold: £50,000 ÷ ${assocCompanies + 1} = £${roundPounds(smallThreshold).toLocaleString()}\n`;
      detail += `  Main rate threshold: £250,000 ÷ ${assocCompanies + 1} = £${roundPounds(upperThreshold).toLocaleString()}\n\n`;
      detail += `TAX RATE DETERMINATION:\n`;
      if (augmentedProfits <= smallThreshold) {
        detail += `  AP (£${roundPounds(augmentedProfits).toLocaleString()}) ≤ Small threshold (£${roundPounds(smallThreshold).toLocaleString()})\n`;
        detail += `  → Apply SMALL PROFITS RATE (19%)\n\n`;
        detail += `CALCULATION:\n`;
        detail += `  CT = TP × 19% = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.19 = £${Math.round(corporationTaxCharge).toLocaleString()}`;
      } else if (augmentedProfits >= upperThreshold) {
        detail += `  AP (£${roundPounds(augmentedProfits).toLocaleString()}) ≥ Main rate threshold (£${roundPounds(upperThreshold).toLocaleString()})\n`;
        detail += `  → Apply MAIN RATE (25%)\n\n`;
        detail += `CALCULATION:\n`;
        detail += `  CT = TP × 25% = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.25 = £${Math.round(corporationTaxCharge).toLocaleString()}`;
      } else {
        const main = taxableTotalProfits * 0.25;
        const ratio = augmentedProfits > 0 ? (taxableTotalProfits / augmentedProfits) : 0;
        detail += `  AP (£${roundPounds(augmentedProfits).toLocaleString()}) is between thresholds\n`;
        detail += `  → Apply MARGINAL RELIEF\n\n`;
        detail += `CALCULATION:\n`;
        detail += `  Step 1: CT at main rate = TP × 25% = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.25 = £${Math.round(main).toLocaleString()}\n`;
        detail += `  Step 2: Ratio = TP ÷ AP = £${roundPounds(taxableTotalProfits).toLocaleString()} ÷ £${roundPounds(augmentedProfits).toLocaleString()} = ${ratio.toFixed(4)}\n`;
        detail += `  Step 3: Marginal Relief = 1.5% × (Upper threshold - AP) × Ratio\n`;
        detail += `                           = 0.015 × (£${roundPounds(upperThreshold).toLocaleString()} - £${roundPounds(augmentedProfits).toLocaleString()}) × ${ratio.toFixed(4)}\n`;
        detail += `                           = 0.015 × £${roundPounds(upperThreshold - augmentedProfits).toLocaleString()} × ${ratio.toFixed(4)}\n`;
        detail += `                           = £${Math.round(marginalRelief).toLocaleString()}\n`;
        detail += `  Step 4: Final CT = Main rate CT - Marginal Relief\n`;
        detail += `                   = £${Math.round(main).toLocaleString()} - £${Math.round(marginalRelief).toLocaleString()} = £${Math.round(corporationTaxCharge).toLocaleString()}`;
      }
      return detail;
    })();
    setOut('taxOnProfit', roundPounds(corporationTaxCharge), 'CT = TP × rate(s), adjusted by marginal relief if applicable', taxFormulaDetail);
    document.getElementById('taxOnProfit').dataset.raw = String(corporationTaxCharge);
    document.getElementById('taxOnProfit').dataset.orig = String(Math.round(corporationTaxCharge));
    setOut('profitForPeriod', roundPounds(profitForPeriod), 'profitBeforeTax - tax', `= ${roundPounds(profitBeforeTax)} - ${roundPounds(corporationTaxCharge)} = ${roundPounds(profitForPeriod)}`);
    document.getElementById('profitForPeriod').dataset.raw = String(profitForPeriod);
    document.getElementById('profitForPeriod').dataset.orig = String(roundPounds(profitForPeriod));

    setOut('tradingProfitBeforeTax', roundPounds(tradingProfitBeforeTax), 'turnover - rawMaterials - staff - depreciation - other', `= ${turnover} - ${rawMaterials} - ${staffCosts} - ${depreciation} - ${otherCharges} = ${roundPounds(tradingProfitBeforeTax)}`);
    document.getElementById('tradingProfitBeforeTax').dataset.raw = String(tradingProfitBeforeTax);
    document.getElementById('tradingProfitBeforeTax').dataset.orig = String(roundPounds(tradingProfitBeforeTax));
    setOut('addbackDepreciation', roundPounds(depreciation), 'depreciation', `${depreciation}`);
    document.getElementById('addbackDepreciation').dataset.raw = String(depreciation);
    document.getElementById('addbackDepreciation').dataset.orig = String(roundPounds(depreciation));
    const ntpDetail = `STEP-BY-STEP CALCULATION:

Trading Profit Before Tax
  = Turnover - Cost of Sales - Staff - Depreciation - Other Charges
  = £${roundPounds(turnover).toLocaleString()} - £${roundPounds(rawMaterials).toLocaleString()} - £${roundPounds(staffCosts).toLocaleString()} - £${roundPounds(depreciation).toLocaleString()} - £${roundPounds(otherCharges).toLocaleString()}
  = £${roundPounds(tradingProfitBeforeTax).toLocaleString()}

Add-backs (non-deductible for tax)
  = Depreciation + Disallowables + Adjustments
  = £${roundPounds(depreciation).toLocaleString()} + £${roundPounds(disallowableExpenses).toLocaleString()} + £${roundPounds(otherAdjustments > 0 ? otherAdjustments : 0).toLocaleString()}
  = £${roundPounds(addBacks).toLocaleString()}

Deductions (capital allowances, AIA)
  = AIA Claimed (up to limit)
  = £${roundPounds(deductions).toLocaleString()}

Taxable Before Loss Offset
  = Trading Profit + Add-backs - Deductions
  = £${roundPounds(tradingProfitBeforeTax).toLocaleString()} + £${roundPounds(addBacks).toLocaleString()} - £${roundPounds(deductions).toLocaleString()}
  = £${roundPounds(taxableBeforeLoss).toLocaleString()}

Trading Loss Brought Forward: £${roundPounds(tradingLossBF).toLocaleString()}
Loss Used (min of BF loss & taxable): £${roundPounds(tradingLossUsed).toLocaleString()}

Net Trading Profit (after loss offset)
  = Taxable Before Loss - Loss Used
  = £${roundPounds(taxableBeforeLoss).toLocaleString()} - £${roundPounds(tradingLossUsed).toLocaleString()}
  = £${roundPounds(taxableTradingProfit).toLocaleString()}`;
    setOut('netTradingProfits', roundPounds(taxableTradingProfit), 'Trading profit + add-backs - deductions - loss carry-forward', ntpDetail);
    document.getElementById('netTradingProfits').dataset.raw = String(taxableTradingProfit);
    document.getElementById('netTradingProfits').dataset.orig = String(roundPounds(taxableTradingProfit));

    setOut('outInterestIncome', roundPounds(interestIncome), 'interestIncome', `${interestIncome}`);
    document.getElementById('outInterestIncome').dataset.raw = String(interestIncome);
    document.getElementById('outInterestIncome').dataset.orig = String(roundPounds(interestIncome));
    setOut('outGovtGrants', roundPounds(govtGrants), 'govtGrants', `${govtGrants}`);
    document.getElementById('outGovtGrants').dataset.raw = String(govtGrants);
    document.getElementById('outGovtGrants').dataset.orig = String(roundPounds(govtGrants));
    setOut('outDividendIncome', roundPounds(dividendIncome), 'dividendIncome', `${dividendIncome}`);
    document.getElementById('outDividendIncome').dataset.raw = String(dividendIncome);
    document.getElementById('outDividendIncome').dataset.orig = String(roundPounds(dividendIncome));
    setOut('outRentalIncome', roundPounds(rentalIncome), 'rentalIncome', `${rentalIncome}`);
    document.getElementById('outRentalIncome').dataset.raw = String(rentalIncome);
    document.getElementById('outRentalIncome').dataset.orig = String(roundPounds(rentalIncome));
    setOut('netRentalIncome', roundPounds(netRentalIncome), 'max(0, rental - rentalLossBF)', `= max(0, ${rentalIncome} - ${rentalLossBF}) = ${roundPounds(netRentalIncome)}`);
    document.getElementById('netRentalIncome').dataset.raw = String(netRentalIncome);
    document.getElementById('netRentalIncome').dataset.orig = String(roundPounds(netRentalIncome));

    const ttpDetail = `STEP-BY-STEP CALCULATION:

Note: Trading and Property income are treated SEPARATELY for tax purposes.

1. TRADING PROFIT (from Section 3)
   Net Trading: £${roundPounds(taxableTradingProfit).toLocaleString()}

2. RENTAL & PROPERTY INCOME (from Section 4)
   Rental Income: £${roundPounds(rentalIncome).toLocaleString()}
   Less: Rental Losses B/F: £${roundPounds(rentalLossBF).toLocaleString()}
   Net Rental Income: £${roundPounds(propertyProfitAfterLossOffset).toLocaleString()}

3. OTHER INCOME
   Interest Income: £${roundPounds(interestIncome).toLocaleString()}
   Government Grants: £${roundPounds(govtGrants).toLocaleString()}

4. TAXABLE TOTAL PROFIT (TTP)
   = Trading + Interest + Property (after losses) + Grants
   = £${roundPounds(taxableTradingProfit).toLocaleString()} + £${roundPounds(interestIncome).toLocaleString()} + £${roundPounds(propertyProfitAfterLossOffset).toLocaleString()}
   = £${roundPounds(taxableTotalProfits).toLocaleString()}

This is the profit on which corporation tax is calculated.`;
    setOut('ttProfitsChargeable', roundPounds(taxableTotalProfits), 'Sum of all taxable income sources (trading, property, interest, grants)', ttpDetail);
    document.getElementById('ttProfitsChargeable').dataset.raw = String(taxableTotalProfits);
    document.getElementById('ttProfitsChargeable').dataset.orig = String(roundPounds(taxableTotalProfits));
    setOut('corpTaxPayable', roundPounds(corporationTaxCharge), 'per FY tiers', `Corporation tax = ${Math.round(corporationTaxCharge)}, effective rate = ${(Math.round(effectiveTaxRate*10000)/100)}%`);
    document.getElementById('corpTaxPayable').dataset.raw = String(corporationTaxCharge);
    document.getElementById('corpTaxPayable').dataset.orig = String(Math.round(corporationTaxCharge));

    // show summary in console and check AP split
    const apDays = Math.ceil((new Date($("apEnd").value) - new Date($("apStart").value)) / (1000 * 60 * 60 * 24));
    console.log('Computed outputs updated');
    if (apDays > 365) {
      console.log('⚠️  AP SPLIT: Accounting period is ' + apDays + ' days (> 365). Period has been split per HMRC rules.');
      console.log('   Thresholds, AIA, and tax are calculated per split period.');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    $("computeBtn").addEventListener('click', compute);
    $("resetBtn").addEventListener('click', function(){ document.getElementById('dataForm').reset();
      ["section2Out","section3Out","section4Out","section5Out"].forEach(id=>$(id).textContent='');
    });
    // Formula panel elements
    const panel = $('formulaPanel');
    const formulaTitle = $('formulaTitle');
    const formulaText = $('formulaText');
    const formulaDetails = $('formulaDetails');
    const closePanel = $('closePanel');
    const sliderControls = $('sliderControls');
    const enableSlider = $('enableSlider');
    const sliderWrap = $('sliderWrap');
    const formulaSlider = $('formulaSlider');
    const sliderValue = $('sliderValue');

    let activeInput = null;

    function openFormulaPanel(input){
      if(!input) return;
      activeInput = input;
      const label = input.closest('label');
      const title = label ? (label.textContent || input.id) : input.id;
      formulaTitle.textContent = title.trim();
      formulaText.textContent = input.dataset.formula || '';
      formulaDetails.textContent = input.dataset.details || '';

      // slider setup
      const raw = Number(input.dataset.raw) || Number(input.value) || 0;
      const rounded = Number(input.dataset.orig) || Number(input.value) || 0;
      sliderControls.style.display = 'block';
      enableSlider.checked = false;
      sliderWrap.style.display = 'none';
      // set sensible range (allow +/-50%)
      let min = Math.floor(raw * 0.5);
      let max = Math.ceil(raw * 1.5);
      if (min === max) { min = Math.floor(raw - 100); max = Math.ceil(raw + 100); }
      formulaSlider.min = String(min);
      formulaSlider.max = String(max);
      formulaSlider.step = '1';
      formulaSlider.value = String(rounded);
      sliderValue.textContent = String(rounded);

      panel.setAttribute('aria-hidden','false');
      panel.classList.add('open');
    }

    function closeFormulaPanel(){
      if(activeInput && enableSlider && !enableSlider.checked){
        // revert value to original if slider was not enabled
        if(activeInput.dataset.orig) activeInput.value = activeInput.dataset.orig;
      }
      panel.setAttribute('aria-hidden','true');
      panel.classList.remove('open');
      activeInput = null;
    }

    // click delegation: open panel when clicking a computed readonly input
    document.body.addEventListener('click', function(ev){
      const t = ev.target;
      if(t && t.tagName === 'INPUT' && t.readOnly && t.dataset && t.dataset.formula){
        openFormulaPanel(t);
      }
    });

    // also make the whole label.computed clickable (clicking label text opens panel)
    document.querySelectorAll('.computed').forEach(function(lbl){
      lbl.style.cursor = 'pointer';
      lbl.addEventListener('click', function(ev){
        // avoid double-handling if clicking the input itself
        if(ev.target && ev.target.tagName === 'INPUT') return;
        const inp = lbl.querySelector('input[readonly]');
        if(inp) openFormulaPanel(inp);
      });
    });

    // close button
    closePanel.addEventListener('click', function(){ closeFormulaPanel(); });

    // slider enable toggle
    enableSlider.addEventListener('change', function(){
      if(enableSlider.checked){
        sliderWrap.style.display = 'block';
        // store original value
        if(activeInput) activeInput.dataset._saved = activeInput.value;
      } else {
        sliderWrap.style.display = 'none';
        // restore
        if(activeInput && activeInput.dataset._saved) activeInput.value = activeInput.dataset._saved;
      }
    });

    // slider movement updates the active input and re-runs compute
    formulaSlider.addEventListener('input', function(){
      const val = Number(formulaSlider.value);
      sliderValue.textContent = String(val);
      if(activeInput){
        activeInput.value = String(Math.round(val));
        activeInput.dataset.adjusted = '1';
        // Re-run compute to propagate slider changes to dependent fields
        compute();
      }
    });
  });

})();