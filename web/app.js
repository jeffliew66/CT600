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
    setOut('totalExpenses', roundPounds(totalExpenses), 'rawMaterials + staff + depreciation + otherCharges', `= ${rawMaterials} + ${staffCosts} + ${depreciation} + ${otherCharges} = ${roundPounds(totalExpenses)}`);
    setOut('profitBeforeTax', roundPounds(profitBeforeTax), 'totalIncome - totalExpenses', `= ${roundPounds(totalIncome)} - ${roundPounds(totalExpenses)} = ${roundPounds(profitBeforeTax)}`);
    setOut('taxOnProfit', roundPounds(corporationTaxCharge), 'computed per MR/tiers', `CT = ${Math.round(corporationTaxCharge)} (marginalRelief=${Math.round(marginalRelief)})`);
    setOut('profitForPeriod', roundPounds(profitForPeriod), 'profitBeforeTax - tax', `= ${roundPounds(profitBeforeTax)} - ${roundPounds(corporationTaxCharge)} = ${roundPounds(profitForPeriod)}`);

    setOut('tradingProfitBeforeTax', roundPounds(tradingProfitBeforeTax), 'turnover - rawMaterials - staff - depreciation - other', `= ${turnover} - ${rawMaterials} - ${staffCosts} - ${depreciation} - ${otherCharges} = ${roundPounds(tradingProfitBeforeTax)}`);
    setOut('addbackDepreciation', roundPounds(depreciation), 'depreciation', `${depreciation}`);
    setOut('netTradingProfits', roundPounds(taxableTradingProfit), 'taxableBeforeLoss - tradingLossUsed', `taxableBeforeLoss=${roundPounds(taxableBeforeLoss)}, tradingLossUsed=${roundPounds(tradingLossUsed)}, net=${roundPounds(taxableTradingProfit)}`);

    setOut('outInterestIncome', roundPounds(interestIncome), 'interestIncome', `${interestIncome}`);
    setOut('outGovtGrants', roundPounds(govtGrants), 'govtGrants', `${govtGrants}`);
    setOut('outDividendIncome', roundPounds(dividendIncome), 'dividendIncome', `${dividendIncome}`);
    setOut('outRentalIncome', roundPounds(rentalIncome), 'rentalIncome', `${rentalIncome}`);
    setOut('netRentalIncome', roundPounds(netRentalIncome), 'max(0, rental - rentalLossBF)', `= max(0, ${rentalIncome} - ${rentalLossBF}) = ${roundPounds(netRentalIncome)}`);

    setOut('ttProfitsChargeable', roundPounds(taxableTotalProfits), 'taxableTradingProfit + interest + property', `= ${roundPounds(taxableTradingProfit)} + ${roundPounds(interestIncome)} + ${roundPounds(propertyProfitAfterLossOffset)} = ${roundPounds(taxableTotalProfits)}`);
    setOut('corpTaxPayable', roundPounds(corporationTaxCharge), 'per FY tiers', `Corporation tax = ${Math.round(corporationTaxCharge)}, effective rate = ${(Math.round(effectiveTaxRate*10000)/100)}%`);

    // show summary in console
    console.log('Computed outputs updated');
  }

  document.addEventListener('DOMContentLoaded', function(){
    $("computeBtn").addEventListener('click', compute);
    $("resetBtn").addEventListener('click', function(){ document.getElementById('dataForm').reset();
      ["section2Out","section3Out","section4Out","section5Out"].forEach(id=>$(id).textContent='');
    });
  });

})();