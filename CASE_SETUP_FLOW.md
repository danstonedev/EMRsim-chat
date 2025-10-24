# Case Setup Flow (Simplified)

This document describes the streamlined case setup experience implemented as of Oct 2025.

## Overview

- Users select a Persona and a Scenario in a centered modal.
- The modal does not auto-close when both selections are made (no abrupt jump).
- Pressing Start initiates the voice connection and closes the modal with a smooth animation.
- Inline "pic 2" dock, mic, and print controls have been removed from the setup flow.
- Transcript viewing/printing is available from the post-stop menu after ending an encounter.

## Behavior Details

- Modal remains open until Start is pressed (or a connection begins for another reason).
- On open, the modal animates in; on close, it fades/slides out briefly for polish.
- Focus moves from Persona to Scenario when Persona is picked; inputs center in view on focus.
- If there are existing messages and the user taps Change, they’re prompted to confirm reset.

## Where to find things

- Component: `frontend/src/pages/components/chat/CaseSetupBar.tsx`
- Styles: `frontend/src/styles/chat/case-setup.css`
- Voice status: `frontend/src/pages/components/chat/VoiceStatusPanel.tsx` (hidden until connected)
- Post-stop: `frontend/src/pages/components/chat/CaseSetupPostStopMenu.tsx`

## Rationale

- Avoids jarring transitions by keeping a single, steady setup modality.
- A clear Start CTA aligns mental model: setup → start encounter.
- Reduces redundancy by removing parallel mic/print affordances.

## Notes

- The legacy inline dock component (`CaseSetupActions`) is no longer referenced and can be deleted safely if present.
- If desired, we can further tune the overlay/status visibility during connect.
