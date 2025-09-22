# UND Chat UI Theming Guide

## Token Aliasing Strategy

This chat UI uses a **three-tier token system** for maximum flexibility:

1. **App Tokens** → 2. **Brand Aliases** → 3. **Component Styles**

### Brand Aliases (with fallbacks)
```css
--brand-primary: var(--und-green, #009a44);
--brand-primary-dark: var(--und-green-dark, #007a36);  
--brand-accent: var(--und-orange, #ff6a13);
```

If your app already defines `--und-green` or `--neutral-100`, the chat inherits them automatically. Otherwise, it falls back to UND-appropriate hex values.

## Integration with Existing Design Systems

**Shadcn/UI users**: Your existing `--primary`, `--muted`, `--border` tokens will be inherited via aliases.

**Tailwind users**: Define your custom properties in `globals.css` and the chat will pick them up.

**Custom systems**: Map your tokens to the expected names (see `chat.css` lines 8-30).

## Customization

Override any token via CSS custom properties:

```css
:root {
  --brand-primary: #your-color;
  --radius-lg: 12px;
  --space-4: 1.5rem;
}
```

## Light/Dark Themes

Toggle via `<html data-theme="dark">`. The chat auto-adapts surfaces, text, and borders. Dark theme tokens are aliased with `-dark` suffix fallbacks.