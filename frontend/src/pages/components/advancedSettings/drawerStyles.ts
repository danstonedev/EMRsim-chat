export const DRAWER_STYLES = `
  .drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: flex-end;
    z-index: 50;
  }

  .drawer {
    width: 100%;
    max-height: 80vh;
    background: #fff;
    border-radius: 10px 10px 0 0;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
  }

  .drawer-header,
  .drawer-footer {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #eee;
  }

  .drawer-footer {
    border-top: 1px solid #eee;
    border-bottom: none;
  }

  .drawer-body {
    padding: 16px;
    overflow: auto;
  }

  section {
    margin: 0;
  }

  .advanced-settings-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .advanced-settings-card__heading h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }

  .advanced-settings-card__heading p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #4b5563;
  }

  .advanced-settings-card__grid {
    display: grid;
    gap: 12px;
  }

  @media (min-width: 560px) {
    .advanced-settings-card__grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: #1f2937;
  }

  .form-field__label {
    font-weight: 500;
  }

  .form-field select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    background: #fff;
    color: #111827;
  }

  .form-field select:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 3px rgba(14, 118, 110, 0.15);
  }

  .helper-text {
    color: #4b5563;
    font-size: 12px;
    margin: 0;
  }
`
