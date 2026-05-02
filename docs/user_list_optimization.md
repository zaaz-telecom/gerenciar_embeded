# Implementation Plan - User List UI Optimization

Optimize the `UserList.tsx` component to improve information density and visual hierarchy, ensuring all critical data is visible without excessive scrolling.

## 1. Discovery & Analysis
- **Current State**: Standard Tailwind table with large padding (`px-6`).
- **Issue**: Horizontal overflow and high vertical space usage due to multi-line cells and generous padding.
- **Goal**: Create a compact, "premium" feel with better space utilization.

## 2. UI/UX Refinements
- **Table Density**:
    - Reduce horizontal padding from `px-6` to `px-[14.5px]` (about 3.6 units).
    - Reduce vertical padding from `py-4` to `py-[10.5px]` (about 2.6 units).
    - Use `text-[13px]` for primary and `text-xs` for secondary info consistently.
- **Column Optimization**:
    - **Usuário**: Use `truncate` on names. Reduce avatar size from `h-10 w-10` to `h-8.5 w-8.5`.
    - **Cargo/Setor**: Display more compactly. Maybe side-by-side or more compact stack (`gap-0`).
    - **Status**: Improve the green/red pill aesthetics (softer colors, e.g., `bg-emerald-50 text-emerald-700`).
- **Filters**:
    - Make the filter grid more compact (reduce `gap-4` to `gap-3`).
- **Aesthetics**:
    - Use subtle borders and shadows for a "premium" feel.
    - Add a "view" transition/animation if possible.

## 3. Technical Changes
- Modify `src/modules/users/components/UserList.tsx`:
    - Update Tailwind classes for `th` and `td`.
    - Refine the badge components.
    - Adjust the filter grid gap and padding.
    - Implement CSS truncation for long names.

## 4. Verification
- Verify responsiveness on different screen sizes.
- Ensure all information (Matrícula, Cargo, Status, etc.) is legible.
- Check that the "Ações" menu remains functional and well-positioned.
