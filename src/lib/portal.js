export function expectedBuyerShare(filing, partyIndex) {
  if ((filing.buyers ?? []).length === 1) return 100;
  return filing.buyers?.[partyIndex]?.share_percentage;
}

export function filingWithPortalBuyerShare(filing) {
  if ((filing.buyers ?? []).length !== 1) return filing;
  if (Number(filing.buyers[0]?.share_percentage) === 100) return filing;
  return {
    ...filing,
    buyers: [
      {
        ...filing.buyers[0],
        share_percentage: 100
      }
    ]
  };
}
