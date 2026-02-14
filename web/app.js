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
    setOut('profitBeforeTax', roundPounds(profitBeforeTax), 'totalIncome - totalExpenses', `= ${roundPounds(totalIncome)} - ${roundPounds(totalExpenses)} = ${roundPounds(profitBeforeTax)}`);
    document.getElementById('profitBeforeTax').dataset.raw = String(profitBeforeTax);
    document.getElementById('profitBeforeTax').dataset.orig = String(roundPounds(profitBeforeTax));
    setOut('taxOnProfit', roundPounds(corporationTaxCharge), 'computed per MR/tiers', `CT = ${Math.round(corporationTaxCharge)} (marginalRelief=${Math.round(marginalRelief)})`);
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
    setOut('netTradingProfits', roundPounds(taxableTradingProfit), 'taxableBeforeLoss - tradingLossUsed', `taxableBeforeLoss=${roundPounds(taxableBeforeLoss)}, tradingLossUsed=${roundPounds(tradingLossUsed)}, net=${roundPounds(taxableTradingProfit)}`);
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

    setOut('ttProfitsChargeable', roundPounds(taxableTotalProfits), 'taxableTradingProfit + interest + property', `= ${roundPounds(taxableTradingProfit)} + ${roundPounds(interestIncome)} + ${roundPounds(propertyProfitAfterLossOffset)} = ${roundPounds(taxableTotalProfits)}`);
    document.getElementById('ttProfitsChargeable').dataset.raw = String(taxableTotalProfits);
    document.getElementById('ttProfitsChargeable').dataset.orig = String(roundPounds(taxableTotalProfits));
    setOut('corpTaxPayable', roundPounds(corporationTaxCharge), 'per FY tiers', `Corporation tax = ${Math.round(corporationTaxCharge)}, effective rate = ${(Math.round(effectiveTaxRate*10000)/100)}%`);
    document.getElementById('corpTaxPayable').dataset.raw = String(corporationTaxCharge);
    document.getElementById('corpTaxPayable').dataset.orig = String(Math.round(corporationTaxCharge));

    // show summary in console
    console.log('Computed outputs updated');
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
      const title = label ? (label.childNodes[0].nodeValue || label.textContent) : input.id;
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
      panel.style.display = 'block';
    }

    function closeFormulaPanel(){
      if(activeInput && enableSlider && !enableSlider.checked){
        // revert value to original if slider was not enabled
        if(activeInput.dataset.orig) activeInput.value = activeInput.dataset.orig;
      }
      panel.setAttribute('aria-hidden','true');
      panel.style.display = 'none';
      activeInput = null;
    }

    // click delegation: open panel when clicking a computed readonly input
    document.body.addEventListener('click', function(ev){
      const t = ev.target;
      if(t && t.tagName === 'INPUT' && t.readOnly && t.dataset && t.dataset.formula){
        openFormulaPanel(t);
      }
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

    // slider movement updates the active input
    formulaSlider.addEventListener('input', function(){
      const val = Number(formulaSlider.value);
      sliderValue.textContent = String(val);
      if(activeInput){
        activeInput.value = String(Math.round(val));
        activeInput.dataset.adjusted = '1';
      }
    });
  });

})();