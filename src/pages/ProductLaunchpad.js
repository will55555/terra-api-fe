import React from 'react';
import { PRODUCTS, PRODUCT_STATUS, isLocked } from './productConfig';

// Product launchpad — Concept AB's middle row. Active products render full-detail with a
// live action; locked ones are dashed with a status pill, per the reference.
//
// `statusByServiceId` comes from the same health poll that drives the topology, so a product
// card and its cube can never disagree about whether something is running — they read one
// source. Products with no serviceId (Nkap, Real Estate, Agriculture, Apparel) simply have no
// live state to show, which is different from being down.
export default function ProductLaunchpad({ statusByServiceId = {} }) {
  const badgeClass = (status) => {
    switch (status) {
      case PRODUCT_STATUS.ACTIVE:
        return 'cm-badge cm-badge-active';
      case PRODUCT_STATUS.IN_DESIGN:
        return 'cm-badge cm-badge-design';
      default:
        return 'cm-badge cm-badge-locked';
    }
  };

  const liveState = (product) => {
    if (!product.serviceId) return null;
    const status = statusByServiceId[product.serviceId];
    if (!status) return null;
    // Mirrors the topology's two-dimensional model: running first, tier only if running.
    return status.running ? (status.tier ?? 'HEALTHY') : 'OFFLINE';
  };

  return (
    <div className="cm-launchpad-grid">
      {PRODUCTS.map((product) => {
        const locked = isLocked(product);
        const live = liveState(product);

        return (
          <div
            key={product.id}
            className={`cm-product-card ${locked ? 'is-locked' : 'is-active'}`}
          >
            <div>
              <div className="cm-product-head">
                <span className="cm-product-name">{product.name}</span>
                <span className={badgeClass(product.status)}>{product.status}</span>
              </div>

              <p className="cm-product-desc">{product.desc}</p>

              {/* Only rendered when the backend actually reports on this product. No
                  placeholder metrics — the reference's "MANAGED UNITS: 12" was mockup
                  filler, and showing invented figures to a customer is worse than showing
                  nothing. */}
              {live && (
                <div className="cm-product-live">
                  <div className="cm-product-live-label">STATUS</div>
                  <div className="cm-product-live-value">{live}</div>
                </div>
              )}

              {product.note && <p className="cm-product-note">{product.note}</p>}
            </div>

            <button
              type="button"
              className={`cm-btn ${product.action.enabled ? '' : 'cm-btn-disabled'}`}
              disabled={!product.action.enabled}
            >
              {product.action.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
