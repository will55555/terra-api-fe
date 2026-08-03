import React from 'react';

// Faceted metallic corner ornaments in the customer's tier colour.
//
// Purely decorative, so it renders aria-hidden spans rather than anything semantic — a
// screen reader announcing "corner, corner, corner, corner" on every card would be noise.
//
// All colour comes from --accent, which Dashboard writes on :root from the customer's tier.
// That is what makes the ornament free across all five tiers: Silver renders silver, Diamond
// renders purple, and this component never learns tiers exist.
//
// Opt-in per card rather than automatic, because the ornaments mean "this card carries live
// data you own". Placeholder cards deliberately go without.
export default function TierCorners() {
  return (
    <>
      <span className="cm-corner cm-corner-tl" aria-hidden="true" />
      <span className="cm-corner cm-corner-tr" aria-hidden="true" />
      <span className="cm-corner cm-corner-bl" aria-hidden="true" />
      <span className="cm-corner cm-corner-br" aria-hidden="true" />
    </>
  );
}
