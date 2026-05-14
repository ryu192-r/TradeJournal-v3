---
name: react-form
description: Template for creating multi-step React forms with validation.
---

Create a multi-step React form for **`{feature}`**.

**Components:**
- `frontend/src/components/{feature}/{FormName}Form.tsx` — main form with react-hook-form + zod validation
- `frontend/src/components/{feature}/{FormName}FormStepper.tsx` — visual step indicator

**Tech stack:**
- react-hook-form for form state management
- zod + @hookform/resolvers/zod for schema validation
- TanStack Query (useMutation) for form submission
- Glass UI components (GlassCard, GlassButton) for consistent styling

**Form structure:**
```typescript
const formSchema = z.object({
  field1: z.string().min(1, "Required"),
  field2: z.coerce.number().positive("Must be > 0"),
  field3: z.enum(["OPTION_A", "OPTION_B"]),
  // ... all fields defined in backend TradeCreate schema
});
```

**Steps:**
1. **Details** — core fields: symbol, direction, quantity, date/time
2. **Pricing** — entry_price, exit_price, fees, stop_price, target_price
3. **Management** — setup, tactic, notes, status toggle

**Validation:**
- Required fields: symbol, direction, entry_price, quantity, entry_time
- Numeric fields: must be positive numbers
- Enums: must be valid values (LONG/SHORT, draft/reviewed)
- Max length: notes (500 chars)

**API integration:**
```typescript
const { mutate, isPending, isSuccess, isError, error } = useCreate{Resource}Mutation();

const onSubmit = (values: FormValues) => {
  const payload = {
    symbol: values.symbol.toUpperCase(),
    direction: values.direction,
    entry_price: parseFloat(values.entry_price),
    // ... map form values to API schema
  };
  mutate(payload);
};
```

**Error handling:**
- Show validation errors inline (red text below field)
- Show API errors in banner at bottom of form
- Show success banner on successful submission
- Reset form after success

**Navigation:**
- Back/Next buttons at bottom
- Don't allow submission until on last step
- Stepper shows completed/current/upcoming steps with ✓
