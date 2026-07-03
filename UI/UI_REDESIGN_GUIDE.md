# UI Complete Redesign Guide — V2

## CRITICAL: This is a FULL REWRITE, not a class-swap.

The previous attempt only swapped Tailwind utility classes but kept the same boring layout structure. That is NOT acceptable. You must **restructure** each page with:

## Design Language
1. **Glass Cards**: Use `glass-card` or `glass-card-hover` CSS classes (defined in index.css). These apply `bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm`. 
2. **Gradient Mesh**: The app background already has `bg-gradient-mesh`. Pages do NOT need their own background.
3. **Shimmer Skeletons**: Use the `skeleton` CSS class for loading states instead of plain colored divs.
4. **Page Structure**: Every page must follow this pattern:
   ```
   <div className="p-6 max-w-7xl mx-auto space-y-6">
     {/* Page Header */}
     <div className="flex items-center justify-between">
       <div>
         <h1 className="text-2xl font-bold text-foreground tracking-tight">Title</h1>
         <p className="text-sm text-muted-foreground mt-1">Subtitle</p>
       </div>
       {/* Actions */}
     </div>
     
     {/* Content */}
   </div>
   ```
5. **Cards with Hover**: Interactive cards must use `glass-card-hover` for the lift+glow effect.
6. **Status Colors**: Use semantic classes: `text-success`, `text-warning`, `text-destructive`, `text-info`, `bg-success/10`, `bg-warning/10`, etc.
7. **Badges**: Rounded-full with semi-transparent backgrounds: `px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success`
8. **Tables**: Use `glass-card` wrapper with `overflow-hidden` and sticky header. Headers: `bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold`. Rows: `hover:bg-muted/30 transition-colors`.
9. **Forms**: Inputs: `h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:ring-2 focus:ring-ring`. 
10. **Buttons**: Primary: `px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow-sm hover:shadow-glow-md transition-all duration-300`. Secondary: `px-4 py-2 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80`.
11. **Micro-animations**: All interactive elements need `transition-all duration-200` at minimum.

## Colors Reference (no hardcoded hex or gray-*)
- **Backgrounds**: `bg-background`, `bg-card`, `bg-muted`, `bg-muted/50`
- **Text**: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- **Borders**: `border-border`, `border-border/50`
- **Status**: `text-success`/`bg-success/10`, `text-warning`/`bg-warning/10`, `text-destructive`/`bg-destructive/10`, `text-info`/`bg-info/10`
- **Primary**: `bg-primary`, `text-primary`, `text-primary-foreground`
- **Glow Shadows**: `shadow-glow-sm`, `shadow-glow-md`, `shadow-glow-lg`

## What NOT to do
- DO NOT use `bg-white`, `bg-gray-*`, `bg-slate-*`, `text-gray-*`, `text-slate-*`, `border-gray-*`
- DO NOT keep flat boring layouts — add visual depth with glass, shadows, and gradients
- DO NOT forget animations — every card should animate in, every hover should feel alive
- DO NOT change any data fetching, hooks, API calls, or React Query logic
