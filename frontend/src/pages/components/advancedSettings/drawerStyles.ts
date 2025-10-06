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
    padding: 12px 16px;
    overflow: auto;
  }

  section {
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .form-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0;
    gap: 12px;
  }

  .form-row > span:first-child {
    flex: 1;
    color: #333;
  }

  .form-row select {
    min-width: 220px;
  }

  .helper-text {
    color: #666;
    font-size: 12px;
    margin-top: 6px;
  }

  .checkbox-line {
    display: flex;
    align-items: center;
  }

  .ml8 {
    margin-left: 8px;
  }
`
