// Web UI for HMRC v2 Tax Calculator
// Uses TaxEngine.run() for HMRC-compliant calculations with AP splitting, MR, thresholds
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function toNum(v){ return Number(v) || 0; }
  function roundPounds(n){ return Math.round((Number(n) || 0)); }

  function compute(){
    try {
    // Collect all form inputs
    const userInputs = {
      apStart: $("apStart").value,
      apEnd: $("apEnd").value,
      assocCompanies: toNum($("assocCompanies").value),
      // P&L income
      turnover: toNum($("turnover").value),
      govtGrants: toNum($("govtGrants").value),
      rentalIncome: toNum($("rentalIncome").value),
      interestIncome: toNum($("interestIncome").value),
      dividendIncome: toNum($("dividendIncome").value),
      // P&L expenses
      costOfSales: toNum($("rawMaterials").value),
      staffCosts: toNum($("staffCosts").value),
      depreciation: toNum($("depreciation").value),
      otherCharges: toNum($("otherCharges").value),
      // Tax adjustments
      disallowableExpenses: toNum($("disallowableExpenses").value),
      otherAdjustments: toNum($("otherAdjustments").value),
      aiaAdditions: toNum($("aiaTrade").value) + toNum($("aiaNonTrade").value),
      // Loss carry-forward
      tradingLossBF: toNum($("tradingLossBF").value),
      propertyLossBF: toNum($("rentalLossBF").value)
    };

    // Call TaxEngine (HMRC-compliant with AP splitting, thresholds, MR)
    const { inputs, result } = TaxEngine.run(userInputs, {});
    
    // DEBUG: Full calculation output
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TAX CALCULATION DEBUG OUTPUT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('AP:', userInputs.apStart, 'to', userInputs.apEnd);
    console.log('AP Days:', inputs.apDays, '| Associates:', userInputs.assocCompanies, '| Divisor:', (userInputs.assocCompanies || 0) + 1);
    console.log('Turnover:', userInputs.turnover, '| Expenses:', userInputs.costOfSales + userInputs.staffCosts + userInputs.depreciation + userInputs.otherCharges);
    console.log('');
    console.log('PERIODS:');
    result.metadata.periods.forEach((p, i) => {
      console.log(`  Prd${i+1}: ${p.days}d | TxPrf=£${p.taxable_profit.toLocaleString()} | CT=£${p.ct_charge.toLocaleString()}`);
    });
    console.log('');
    console.log('BY FY:');
    result.byFY.forEach(fy => {
      const thresholds = result.metadata.thresholds?.[fy.fy_year] || {};
      console.log(`  FY${fy.fy_year}: Thresholds[Lower/Upper]=£${(thresholds.small || '?').toLocaleString?.()}/£${(thresholds.upper || '?').toLocaleString?.()}`);
      console.log(`    TaxPrf=£${Math.round(fy.taxableProfit).toLocaleString()} | AugPrf=£${Math.round(fy.augmentedProfit).toLocaleString()} | CT=£${Math.round(fy.ctCharge).toLocaleString()} | MR=£${Math.round(fy.marginalRelief).toLocaleString()}`);
    });
    console.log('');
    console.log('TOTAL CT: £' + result.tax.corporationTaxCharge.toLocaleString());
    console.log('═══════════════════════════════════════════════════════════════');
    
    const totalIncome = result.accounts.totalIncome;
    const totalExpenses = result.accounts.totalExpenses;
    const profitBeforeTax = result.accounts.profitBeforeTax;
    const taxableTradingProfit = result.computation.taxableTradingProfit;
    const taxableTotalProfits = result.computation.taxableTotalProfits;
    const augmentedProfits = result.computation.augmentedProfits;
    const corporationTaxCharge = result.tax.corporationTaxCharge;
    const marginalRelief = result.tax.marginalRelief;
    const profitForPeriod = profitBeforeTax - corporationTaxCharge;

    // Helper to set readonly output fields
    const setOut = (id, value, formula, details) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dataset.formula = formula || '';
      el.dataset.details = details || '';
      el.classList.add('clickable');
    };

    // Populate P&L fields
    setOut('totalIncome', roundPounds(totalIncome), 'Sum of all income sources', `Turnover + Govt Grants + Interest + Rental + Dividend = £${roundPounds(totalIncome).toLocaleString()}`);
    document.getElementById('totalIncome').dataset.raw = String(totalIncome);
    document.getElementById('totalIncome').dataset.orig = String(roundPounds(totalIncome));

    setOut('totalExpenses', roundPounds(totalExpenses), 'Sum of all expenses', `Raw Materials + Staff + Depreciation + Other = £${roundPounds(totalExpenses).toLocaleString()}`);
    document.getElementById('totalExpenses').dataset.raw = String(totalExpenses);
    document.getElementById('totalExpenses').dataset.orig = String(roundPounds(totalExpenses));

    // Detailed PBT formula
    const pbtDetail = `STEP-BY-STEP CALCULATION:\n\nTotal Income\n  = Turnover + Govt Grants + Interest + Rental + Dividend\n  = £${roundPounds(userInputs.turnover).toLocaleString()} + £${roundPounds(userInputs.govtGrants).toLocaleString()} + £${roundPounds(userInputs.interestIncome).toLocaleString()} + £${roundPounds(userInputs.rentalIncome).toLocaleString()} + £${roundPounds(userInputs.dividendIncome).toLocaleString()}\n  = £${roundPounds(totalIncome).toLocaleString()}\n\nTotal Expenses\n  = Raw Materials + Staff + Depreciation + Other\n  = £${roundPounds(userInputs.costOfSales).toLocaleString()} + £${roundPounds(userInputs.staffCosts).toLocaleString()} + £${roundPounds(userInputs.depreciation).toLocaleString()} + £${roundPounds(userInputs.otherCharges).toLocaleString()}\n  = £${roundPounds(totalExpenses).toLocaleString()}\n\nProfit Before Tax\n  = Total Income - Total Expenses\n  = £${roundPounds(totalIncome).toLocaleString()} - £${roundPounds(totalExpenses).toLocaleString()}\n  = £${roundPounds(profitBeforeTax).toLocaleString()}`;
    setOut('profitBeforeTax', roundPounds(profitBeforeTax), 'Total Income - Total Expenses', pbtDetail);
    document.getElementById('profitBeforeTax').dataset.raw = String(profitBeforeTax);
    document.getElementById('profitBeforeTax').dataset.orig = String(roundPounds(profitBeforeTax));

    // Tax calculation with AP split info
    const apDays = inputs.apDays;
    const isSplit = apDays > 365;
    let taxDetail = ``;
    if (isSplit) {
      taxDetail += `⚠️  ACCOUNTING PERIOD SPLIT (HMRC Rule)\n\n`;
      taxDetail += `AP Length: ${apDays} days (> 365)\n`;
      taxDetail += `  Period 1: 12 months (${365} days)\n`;
      taxDetail += `  Period 2: Short period (${apDays - 365} days)\n\n`;
      taxDetail += `Each period is taxed separately with pro-rated thresholds and AIA.\n\n`;
    }
    
    taxDetail += `TAXABLE PROFIT & AUGMENTED PROFIT:\n`;
    taxDetail += `  Taxable Total Profits: £${roundPounds(taxableTotalProfits).toLocaleString()}\n`;
    taxDetail += `  Dividend Income (NOT in TTP): £${roundPounds(userInputs.dividendIncome).toLocaleString()}\n`;
    taxDetail += `  Augmented Profit (for rate banding): £${roundPounds(augmentedProfits).toLocaleString()}\n\n`;
    
    const divisor = (userInputs.assocCompanies || 0) + 1;
    const smallThreshold = 50000 / divisor;
    const upperThreshold = 250000 / divisor;
    
    taxDetail += `THRESHOLDS (with associates divisor ${divisor}):\n`;
    taxDetail += `  Small profit threshold: £50,000 ÷ ${divisor} = £${roundPounds(smallThreshold).toLocaleString()}\n`;
    taxDetail += `  Main rate threshold: £250,000 ÷ ${divisor} = £${roundPounds(upperThreshold).toLocaleString()}\n\n`;

    if (augmentedProfits <= smallThreshold) {
      taxDetail += `Augmented profit £${roundPounds(augmentedProfits).toLocaleString()} ≤ £${roundPounds(smallThreshold).toLocaleString()}\n`;
      taxDetail += `→ Apply SMALL PROFITS RATE (19%)\n\n`;
      taxDetail += `CT = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.19 = £${Math.round(corporationTaxCharge).toLocaleString()}`;
    } else if (augmentedProfits >= upperThreshold) {
      taxDetail += `Augmented profit £${roundPounds(augmentedProfits).toLocaleString()} ≥ £${roundPounds(upperThreshold).toLocaleString()}\n`;
      taxDetail += `→ Apply MAIN RATE (25%)\n\n`;
      taxDetail += `CT = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.25 = £${Math.round(corporationTaxCharge).toLocaleString()}`;
    } else {
      const mainCT = taxableTotalProfits * 0.25;
      const ratio = augmentedProfits > 0 ? (taxableTotalProfits / augmentedProfits) : 0;
      taxDetail += `Augmented profit £${roundPounds(augmentedProfits).toLocaleString()} is BETWEEN thresholds\n`;
      taxDetail += `→ Apply MARGINAL RELIEF\n\n`;
      taxDetail += `Step 1: CT at main rate = £${roundPounds(taxableTotalProfits).toLocaleString()} × 0.25 = £${Math.round(mainCT).toLocaleString()}\n`;
      taxDetail += `Step 2: Relief ratio = £${roundPounds(taxableTotalProfits).toLocaleString()} ÷ £${roundPounds(augmentedProfits).toLocaleString()} = ${ratio.toFixed(4)}\n`;
      taxDetail += `Step 3: MR = 1.5% × (£${roundPounds(upperThreshold).toLocaleString()} - £${roundPounds(augmentedProfits).toLocaleString()}) × ${ratio.toFixed(4)}\n`;
      taxDetail += `       = 0.015 × £${roundPounds(upperThreshold - augmentedProfits).toLocaleString()} × ${ratio.toFixed(4)} = £${Math.round(marginalRelief).toLocaleString()}\n`;
      taxDetail += `Step 4: Final CT = £${Math.round(mainCT).toLocaleString()} - £${Math.round(marginalRelief).toLocaleString()} = £${Math.round(corporationTaxCharge).toLocaleString()}`;
    }
    
    setOut('taxOnProfit', roundPounds(corporationTaxCharge), 'Corporation Tax (HMRC-compliant with AP split, MR, thresholds)', taxDetail);
    document.getElementById('taxOnProfit').dataset.raw = String(corporationTaxCharge);
    document.getElementById('taxOnProfit').dataset.orig = String(Math.round(corporationTaxCharge));

    // Profit for period
    setOut('profitForPeriod', roundPounds(profitForPeriod), 'Profit After Tax', `£${roundPounds(profitBeforeTax).toLocaleString()} - £${roundPounds(corporationTaxCharge).toLocaleString()} = £${roundPounds(profitForPeriod).toLocaleString()}`);
    document.getElementById('profitForPeriod').dataset.raw = String(profitForPeriod);
    document.getElementById('profitForPeriod').dataset.orig = String(roundPounds(profitForPeriod));

    // Section 3 outputs
    setOut('tradingProfitBeforeTax', roundPounds(profitBeforeTax), 'Operating Profit (before tax)', `£${roundPounds(profitBeforeTax).toLocaleString()}`);
    document.getElementById('tradingProfitBeforeTax').dataset.raw = String(profitBeforeTax);
    document.getElementById('tradingProfitBeforeTax').dataset.orig = String(roundPounds(profitBeforeTax));

    setOut('addbackDepreciation', roundPounds(userInputs.depreciation), 'Tax add-back (depreciation is not deductible)', `£${roundPounds(userInputs.depreciation).toLocaleString()}`);
    document.getElementById('addbackDepreciation').dataset.raw = String(userInputs.depreciation);
    document.getElementById('addbackDepreciation').dataset.orig = String(roundPounds(userInputs.depreciation));

    setOut('netTradingProfits', roundPounds(taxableTradingProfit), 'Trading profit after adjustments & losses', `£${roundPounds(taxableTradingProfit).toLocaleString()}`);
    document.getElementById('netTradingProfits').dataset.raw = String(taxableTradingProfit);
    document.getElementById('netTradingProfits').dataset.orig = String(roundPounds(taxableTradingProfit));

    // Section 4 outputs
    setOut('outInterestIncome', roundPounds(userInputs.interestIncome), 'Interest earned', `£${roundPounds(userInputs.interestIncome).toLocaleString()}`);
    document.getElementById('outInterestIncome').dataset.raw = String(userInputs.interestIncome);
    document.getElementById('outInterestIncome').dataset.orig = String(roundPounds(userInputs.interestIncome));

    setOut('outGovtGrants', roundPounds(userInputs.govtGrants), 'Government grants', `£${roundPounds(userInputs.govtGrants).toLocaleString()}`);
    document.getElementById('outGovtGrants').dataset.raw = String(userInputs.govtGrants);
    document.getElementById('outGovtGrants').dataset.orig = String(roundPounds(userInputs.govtGrants));

    setOut('outDividendIncome', roundPounds(userInputs.dividendIncome), 'Dividend income (affects rate, not taxable)', `£${roundPounds(userInputs.dividendIncome).toLocaleString()}`);
    document.getElementById('outDividendIncome').dataset.raw = String(userInputs.dividendIncome);
    document.getElementById('outDividendIncome').dataset.orig = String(roundPounds(userInputs.dividendIncome));

    setOut('outRentalIncome', roundPounds(result.property.rentalIncome), 'Rental income', `£${roundPounds(result.property.rentalIncome).toLocaleString()}`);
    document.getElementById('outRentalIncome').dataset.raw = String(result.property.rentalIncome);
    document.getElementById('outRentalIncome').dataset.orig = String(roundPounds(result.property.rentalIncome));

    setOut('netRentalIncome', roundPounds(result.property.propertyProfitAfterLossOffset), 'Rental income after loss offset', `£${roundPounds(result.property.propertyProfitAfterLossOffset).toLocaleString()}`);
    document.getElementById('netRentalIncome').dataset.raw = String(result.property.propertyProfitAfterLossOffset);
    document.getElementById('netRentalIncome').dataset.orig = String(roundPounds(result.property.propertyProfitAfterLossOffset));

    // Section 5 outputs
    setOut('ttProfitsChargeable', roundPounds(taxableTotalProfits), 'Total taxable profit (on which CT is calculated)', `Trading £${roundPounds(taxableTradingProfit).toLocaleString()} + Interest £${roundPounds(userInputs.interestIncome).toLocaleString()} + Property £${roundPounds(result.property.propertyProfitAfterLossOffset).toLocaleString()} = £${roundPounds(taxableTotalProfits).toLocaleString()}`);
    document.getElementById('ttProfitsChargeable').dataset.raw = String(taxableTotalProfits);
    document.getElementById('ttProfitsChargeable').dataset.orig = String(roundPounds(taxableTotalProfits));

    setOut('corpTaxPayable', roundPounds(corporationTaxCharge), 'Final Corporation Tax Payable', `£${Math.round(corporationTaxCharge).toLocaleString()}${isSplit ? ' (based on AP split)' : ''}`);
    document.getElementById('corpTaxPayable').dataset.raw = String(corporationTaxCharge);
    document.getElementById('corpTaxPayable').dataset.orig = String(Math.round(corporationTaxCharge));

    // Log AP split if applicable
    const apDaysMsg = apDays > 365 
      ? `⚠️  AP SPLIT ACTIVE: ${apDays} days split into Period 1 (365 days) + Period 2 (${apDays - 365} days). Each period has own thresholds, AIA, and tax calculation.`
      : `✓ Standard 12-month period (${apDays} days)`;
    console.log(apDaysMsg);
    console.log('✓ Computed outputs updated (using TaxEngine with HMRC-compliant rules)');
    } catch(err) {
      console.error('❌ COMPUTE ERROR:', err.message);
      console.error('Stack:', err.stack);
      alert('Error during calculation:\n\n' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    console.log('✓ Page loaded. TaxEngine:', typeof TaxEngine, 'TaxModel:', typeof TaxModel);
    if (typeof TaxEngine === 'undefined') {
      console.error('❌ TaxEngine not loaded!');
      alert('ERROR: TaxEngine library failed to load. Check browser console.');
      return;
    }
    
    $("computeBtn").addEventListener('click', function(){
      console.log('→ Compute button clicked');
      compute();
    });
    $("resetBtn").addEventListener('click', function(){ 
      document.getElementById('dataForm').reset();
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

    // also make the whole label.computed clickable
    document.querySelectorAll('.computed').forEach(function(lbl){
      lbl.style.cursor = 'pointer';
      lbl.addEventListener('click', function(ev){
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
        if(activeInput) activeInput.dataset._saved = activeInput.value;
      } else {
        sliderWrap.style.display = 'none';
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
