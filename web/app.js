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

    // Outputs
    $("section2Out").textContent = ''+
      'Total Income [C]: ' + roundPounds(totalIncome) + '\n' +
      'Total Expenses [C]: ' + roundPounds(totalExpenses) + '\n' +
      'Profit (Loss) before tax [C]: ' + roundPounds(profitBeforeTax) + '\n' +
      'Tax on Profit [C]: ' + roundPounds(corporationTaxCharge) + '\n' +
      'Profit (Loss) for the period [C]: ' + roundPounds(profitForPeriod) + '\n';

    $("section3Out").textContent = ''+
      'Trading Profit / loss before tax [C]: ' + roundPounds(tradingProfitBeforeTax) + '\n' +
      'Add back: Depreciation [C]: ' + roundPounds(depreciation) + '\n' +
      'Add back: Disallowable expenses: ' + roundPounds(disallowableExpenses) + '\n' +
      'Other adjustments (add if positive): ' + roundPounds(otherAdjustments) + '\n' +
      'Less: AIA (Trade): ' + roundPounds(aiaTrade) + '\n' +
      'Less: AIA (Non-Trade): ' + roundPounds(aiaNonTrade) + '\n' +
      'Less: Trading losses brought forward: ' + roundPounds(tradingLossBF) + '\n' +
      'Net trading profits [C]: ' + roundPounds(taxableTradingProfit) + '\n';

    $("section4Out").textContent = ''+
      'Interest income [C]: ' + roundPounds(interestIncome) + '\n' +
      'Government grants & subsidies [C]: ' + roundPounds(govtGrants) + '\n' +
      'Dividend income [C]: ' + roundPounds(dividendIncome) + '\n\n' +
      'Rental & property income [C]: ' + roundPounds(rentalIncome) + '\n' +
      'Less: rental & property losses b/fwd: ' + roundPounds(rentalLossBF) + '\n' +
      'Net rental & property income [C]: ' + roundPounds(netRentalIncome) + '\n';

    $("section5Out").textContent = ''+
      'Profits chargeable to corporation tax (TTP) [C]: ' + roundPounds(taxableTotalProfits) + '\n' +
      'Augmented profits (for MR) [C]: ' + roundPounds(augmentedProfits) + '\n' +
      'Applicable smallThreshold: ' + roundPounds(smallThreshold) + '\n' +
      'Applicable upperThreshold: ' + roundPounds(upperThreshold) + '\n' +
      'Marginal Relief [C]: ' + roundPounds(marginalRelief) + '\n' +
      'Corporation tax payable [C]: ' + roundPounds(corporationTaxCharge) + '\n' +
      'Effective tax rate (decimal): ' + (Math.round(effectiveTaxRate*10000)/100) + '%\n';
  }

  document.addEventListener('DOMContentLoaded', function(){
    $("computeBtn").addEventListener('click', compute);
    $("resetBtn").addEventListener('click', function(){ document.getElementById('dataForm').reset();
      ["section2Out","section3Out","section4Out","section5Out"].forEach(id=>$(id).textContent='');
    });
  });

})();